// app.js - Frontend JavaScript logic for Flask backend

// Configuration
let config = {
    conversationModel: 'gemma3:4b',
    scoringModel: 'deepseek:1.5b',
    ollamaEndpoint: 'http://localhost:11434',
    currentTestPart: 1,
    testActive: false,
    timerInterval: null,
    timerSeconds: 0,
    lastTimerValue: 0,
    recognition: null,
    currentAudio: null,  // Track current playing audio
    messageSent: false,  // Flag to track if a message has been sent
    testPrompts: {
        systemPrompt: `You are an IELTS speaking examiner. You should evaluate the student's English speaking ability 
                      according to the IELTS criteria: Fluency and Coherence, Lexical Resource, Grammatical Range 
                      and Accuracy, and Pronunciation. Keep your responses concise and natural like a real examiner. 
                      Do not provide scores during the test, only at the end when explicitly asked.`,
        scoringPrompt: `Please analyze my complete speaking performance throughout this conversation and provide IELTS scores for:
                      1. Fluency and Coherence: Evaluate logical flow, topic development, and coherence of ideas.
                      2. Lexical Resource: Assess vocabulary range, appropriateness, and accuracy.
                      3. Grammatical Range and Accuracy: Judge grammatical structures and correctness.
                      4. Pronunciation: While you cannot hear my pronunciation directly, try to evaluate based on my choice of words and any metadata about my speech.
                      
                      Provide a score out of 9 for each category and an overall band score, with detailed feedback.`,
        part1: {
            intro: "Good morning/afternoon. My name is Aditi. Can you tell me your full name, please? Now, I'd like to ask you some questions about yourself.",
            topics: [
                "Can you describe your hometown?",
                "Do you work or are you a student?",
                "What do you enjoy doing in your free time?",
                "Do you prefer indoor or outdoor activities?",
                "What kind of music do you like to listen to?",
                "Do you enjoy cooking?"
            ]
        },
        part2: {
            intro: "I'm going to give you a topic and I'd like you to talk about it for 1 to 2 minutes. Before you start, you'll have one minute to prepare. Here's some paper and a pencil for making notes if you wish.",
            topics: [
                "Describe a book you have recently read. You should say: what kind of book it is, what it is about, why you decided to read it, and explain why you liked or disliked it.",
                "Describe a place you have visited that made a strong impression on you. You should say: where it is, when you went there, what you did there, and explain why it made such a strong impression on you.",
                "Describe a skill you would like to learn. You should say: what the skill is, how you would learn it, how long it would take to learn, and explain why you want to learn this skill."
            ]
        },
        part3: {
            intro: "Now let's discuss some more general questions related to this topic.",
            topics: {
                "books": [
                    "How have reading habits changed in your country in recent years?",
                    "Do you think digital books will eventually replace printed books?",
                    "What kinds of books are most popular in your country?",
                    "How important is reading for a child's development?"
                ],
                "places": [
                    "What types of places do people from your country like to visit on vacation?",
                    "How has tourism changed in your country over the last few decades?",
                    "Do you think it's better to travel independently or as part of a tour group?",
                    "How might tourism affect local communities?"
                ],
                "skills": [
                    "Why do you think some people are reluctant to learn new skills?",
                    "How has technology changed the way people learn new skills?",
                    "What skills do you think will be most important in the future?",
                    "Should schools focus more on practical skills rather than academic knowledge?"
                ]
            }
        },
        conclusion: "Thank you. That's the end of the speaking test."
    },
    speechMetadata: []
};

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const startRecordingButton = document.getElementById('startRecordingButton');
const stopRecordingButton = document.getElementById('stopRecordingButton');
const stopSpeakingButton = document.getElementById('stopSpeakingButton');
const scoreButton = document.getElementById('scoreButton');
const statusMessage = document.getElementById('statusMessage');
const timerElement = document.getElementById('timer');
const startTestButton = document.getElementById('startTestButton');
const testPartSelector = document.getElementById('testPartSelector');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const conversationModelInput = document.getElementById('conversationModel');
const scoringModelInput = document.getElementById('scoringModel');
const ollamaEndpointInput = document.getElementById('ollamaEndpoint');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeSpeechRecognition();
    attachEventListeners();
    loadSettings();
});

// Punctuation handling function
async function processPunctuation(text) {
    try {
        const response = await fetch('/api/punctuate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error('Error processing punctuation:', error);
        return text; // Return original text if there's an error
    }
}

// Initialize Speech Recognition
function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        config.recognition = new SpeechRecognition();
        config.recognition.continuous = true;
        config.recognition.interimResults = true;
        config.recognition.lang = 'en-IN';
        
        let hasSpeechDetected = false;
        let silenceTimer = null;
        const SILENCE_THRESHOLD = 60000; // 1 minute silence threshold
        let recordingStartTime = 0;
        let lastSpeechTimestamp = 0;
        let tempMessageElement = null;
        let fullTranscript = '';
        
        config.recognition.onstart = () => {
            updateStatus('Listening... Speak now.');
            hasSpeechDetected = false;
            recordingStartTime = Date.now();
            lastSpeechTimestamp = recordingStartTime;
            config.pauseCount = 0;
            config.lastTimerValue = config.timerSeconds;
            fullTranscript = '';
            config.messageSent = false;
            
            startRecordingButton.disabled = true;
            stopRecordingButton.disabled = false;
            
            tempMessageElement = document.createElement('div');
            tempMessageElement.classList.add('message', 'user', 'temp-message');
            tempMessageElement.textContent = '...';
            chatContainer.appendChild(tempMessageElement);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        };

        config.recognition.onresult = async (event) => {
            fullTranscript = '';
            
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const transcript = event.results[i][0].transcript + ' ';
                    const punctuatedText = await processPunctuation(transcript);
                    fullTranscript += punctuatedText;
                } else {
                    fullTranscript += event.results[i][0].transcript + ' ';
                }
            }
            
            fullTranscript = fullTranscript.trim();
            userInput.value = fullTranscript;
            
            if (tempMessageElement) {
                tempMessageElement.textContent = fullTranscript;
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            const currentTime = Date.now();
            if (!hasSpeechDetected) {
                hasSpeechDetected = true;
            } else if (currentTime - lastSpeechTimestamp > 1500) {
                config.pauseCount++;
            }
            lastSpeechTimestamp = currentTime;

            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }

            silenceTimer = setTimeout(async () => {
                if (hasSpeechDetected && !config.messageSent) {
                    const punctuatedTranscript = await processPunctuation(fullTranscript);
                    
                    if (tempMessageElement) {
                        tempMessageElement.remove();
                        tempMessageElement = null;
                    }
                    config.messageSent = true;
                    stopRecording();
                    
                    userInput.value = punctuatedTranscript;
                    sendMessage();
                    setTimeout(() => {
                        collectSpeechMetadata(punctuatedTranscript, recordingStartTime);
                    }, 0);
                }
            }, SILENCE_THRESHOLD);
        };

        config.recognition.onresult = async (event) => {
            fullTranscript = '';
            
            // Just collect the transcript without punctuation during recording
            for (let i = 0; i < event.results.length; i++) {
                fullTranscript += event.results[i][0].transcript + ' ';
            }
            
            fullTranscript = fullTranscript.trim();
            userInput.value = fullTranscript;
            
            if (tempMessageElement) {
                tempMessageElement.textContent = fullTranscript;
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        
            const currentTime = Date.now();
            if (!hasSpeechDetected) {
                hasSpeechDetected = true;
            } else if (currentTime - lastSpeechTimestamp > 1500) {
                config.pauseCount++;
            }
            lastSpeechTimestamp = currentTime;
        };
        
        config.recognition.onend = async () => {
            startRecordingButton.disabled = false;
            stopRecordingButton.disabled = true;
            updateStatus('Recording stopped.');
            
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            
            if (hasSpeechDetected && fullTranscript.trim() !== '' && !config.messageSent) {
                // Only process punctuation once at the end of recording
                const punctuatedTranscript = await processPunctuation(fullTranscript);
                
                if (tempMessageElement) {
                    tempMessageElement.remove();
                    tempMessageElement = null;
                }
                
                config.messageSent = true;
                userInput.value = punctuatedTranscript;
                sendMessage();
                setTimeout(() => {
                    collectSpeechMetadata(punctuatedTranscript, recordingStartTime);
                }, 0);
            } else {
                if (tempMessageElement) {
                    tempMessageElement.remove();
                    tempMessageElement = null;
                }
            }
        };

        config.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            updateStatus('Error with speech recognition: ' + event.error);
            
            if (tempMessageElement) {
                tempMessageElement.remove();
                tempMessageElement = null;
            }
            
            stopRecording();
        };
    } else {
        updateStatus('Speech recognition is not supported in your browser.');
        startRecordingButton.disabled = true;
    }
}


function stopRecording() {
    if (config.recognition) {
        try {
            config.recognition.stop();
        } catch (error) {
            console.error('Error stopping recognition', error);
            updateStatus('Error stopping speech recognition.');
            
            const tempMessage = document.querySelector('.temp-message');
            if (tempMessage) {
                tempMessage.remove();
            }
        }
    }
}

function collectSpeechMetadata(transcript, startTime) {
    setTimeout(() => {
        const elapsedTimeMs = Date.now() - startTime;
        const elapsedTimeSeconds = elapsedTimeMs / 1000;
        
        const words = transcript.trim().split(/\s+/);
        const wordCount = words.length;
        const wordsPerMinute = Math.round((wordCount / elapsedTimeSeconds) * 60);
        
        const hesitationMarkers = (transcript.match(/um|uh|er|hmm|like|you know/gi) || []).length;
        
        let repeatedWords = 0;
        for (let i = 1; i < words.length; i++) {
            if (words[i].toLowerCase() === words[i-1].toLowerCase()) {
                repeatedWords++;
            }
        }
        
        const metadata = {
            timestamp: new Date().toISOString(),
            durationSeconds: elapsedTimeSeconds.toFixed(2),
            wordCount: wordCount,
            wordsPerMinute: wordsPerMinute,
            hesitationMarkers: hesitationMarkers,
            repeatedWords: repeatedWords,
            silencesCount: config.pauseCount
        };
        
        config.speechMetadata.push(metadata);
    }, 0);
}

function startRecording() {
    if (config.recognition) {
        try {
            if (config.currentAudio) {
                stopSpeaking();
            }
            
            userInput.value = '';
            config.recognition.start();
        } catch (error) {
            console.error('Error starting recognition', error);
            updateStatus('Error starting speech recognition.');
        }
    }
}

function stopSpeaking() {
    if (config.currentAudio) {
        config.currentAudio.pause();
        config.currentAudio.currentTime = 0;
        config.currentAudio = null;
        
        stopSpeakingButton.disabled = true;
        updateStatus('Playback stopped.');
        
        startRecordingButton.disabled = false;
        sendButton.disabled = false;
        userInput.disabled = false;
    }
}

async function sendMessage(isScoring = false, customPrompt = null) {
    const userMessage = customPrompt || userInput.value.trim();
    
    if (!userMessage) return;
    
    if (!isScoring || !customPrompt) {
        addMessage(userMessage, 'user');
    }
    
    userInput.value = '';
    updateStatus(`Waiting for response using ...`);
    
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 120000);
    });
    
    try {
        const history = getConversationHistory();
        const systemPrompt = config.testPrompts.systemPrompt;
        const modelToUse = isScoring ? config.scoringModel : config.conversationModel;
        
        const fetchPromise = fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelToUse,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history,
                    { role: 'user', content: userMessage }
                ],
                endpoint: config.ollamaEndpoint
            })
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        const examinerResponse = data.response;
        
        addMessage(examinerResponse, 'examiner');
        
        if (!isScoring) {
            speakText(examinerResponse);
        } else {
            updateStatus('Scoring complete.');
        }
        
    } catch (error) {
        console.error('Error calling API:', error);
        updateStatus(`Error: ${error.message}. Please try again with a shorter response or check your connection.`);
        
        startRecordingButton.disabled = false;
        sendButton.disabled = false;
        userInput.disabled = false;
    }
}

async function speakText(text) {
    updateStatus('Generating speech...');

    const ttsPromise = fetch('/api/tts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            voice: 'default'
        })
    });

    startRecordingButton.disabled = true;
    sendButton.disabled = true;
    userInput.disabled = true;
    stopSpeakingButton.disabled = false;

    try {
        const response = await ttsPromise;

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        config.currentAudio = audio;

        audio.onplay = () => {
            updateStatus('Examiner is speaking...');
        };

        audio.onended = () => {
            updateStatus('Ready for your response.');
            stopSpeakingButton.disabled = true;
            config.currentAudio = null;
            startRecordingButton.disabled = false;
            sendButton.disabled = false;
            userInput.disabled = false;
        };

        audio.onerror = () => {
            updateStatus('Error playing audio.');
            stopSpeakingButton.disabled = true;
            config.currentAudio = null;
            startRecordingButton.disabled = false;
            sendButton.disabled = false;
            userInput.disabled = false;
        };

        audio.play();

    } catch (error) {
        console.error('Error with TTS:', error);
        updateStatus('Error generating speech. Falling back to browser TTS.');

        if ('speechSynthesis' in window) {
            const speech = new SpeechSynthesisUtterance(text);
            speech.lang = 'en-US';
            speech.rate = 0.9;
            speech.pitch = 1;

            speech.onstart = () => {
                updateStatus('Examiner is speaking (using browser TTS)...');
            };

            speech.onend = () => {
                updateStatus('Ready for your response.');
                stopSpeakingButton.disabled = true;
                startRecordingButton.disabled = false;
                sendButton.disabled = false;
                userInput.disabled = false;
            };

            config.currentAudio = {
                pause: () => {
                    window.speechSynthesis.cancel();
                },
                currentTime: 0
            };

            window.speechSynthesis.speak(speech);
        }
    }
}

function addMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    messageDiv.textContent = message;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function getConversationHistory() {
    const messages = [];
    const messageElements = chatContainer.querySelectorAll('.message');
    
    messageElements.forEach(element => {
        const role = element.classList.contains('user') ? 'user' : 'assistant';
        messages.push({
            role: role,
            content: element.textContent
        });
    });
    
    return messages;
}

function updateStatus(message) {
    statusMessage.textContent = message;
}

function startTimer() {
    timerElement.classList.remove('d-none');
    config.timerSeconds = 0;
    updateTimerDisplay();
    
    config.timerInterval = setInterval(() => {
        config.timerSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (config.timerInterval) {
        clearInterval(config.timerInterval);
        config.timerInterval = null;
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(config.timerSeconds / 60);
    const seconds = config.timerSeconds % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTest() {
    chatContainer.innerHTML = '';
    config.testActive = true;
    config.speechMetadata = [];
    config.messageSent = false;
    
    startTimer();
    
    let introMessage = '';
    switch (config.currentTestPart) {
        case 1:
            introMessage = config.testPrompts.part1.intro;
            break;
        case 2:
            const part2Topic = config.testPrompts.part2.topics[
                Math.floor(Math.random() * config.testPrompts.part2.topics.length)
            ];
            introMessage = config.testPrompts.part2.intro + " " + part2Topic;
            break;
        case 3:
            const topicKeys = Object.keys(config.testPrompts.part3.topics);
            const selectedTopic = topicKeys[Math.floor(Math.random() * topicKeys.length)];
            introMessage = config.testPrompts.part3.intro + " " + 
                          config.testPrompts.part3.topics[selectedTopic][0];
            break;
    }
    
    addMessage(introMessage, 'examiner');
    speakText(introMessage);
    updateStatus('Test started. Please respond to the examiner.');
    scoreButton.disabled = false;
}

function requestScoring() {
    const metadataSummary = generateMetadataSummary();
    const scoringPrompt = config.testPrompts.scoringPrompt + "\n\n" + metadataSummary;
    
    updateStatus('Generating IELTS scores using ' + config.scoringModel + '...');
    addMessage("Please evaluate my speaking test performance and provide scores.", 'user');
    sendMessage(true, scoringPrompt);
}

function generateMetadataSummary() {
    if (config.speechMetadata.length === 0) {
        return "No speech metadata available.";
    }
    
    let totalWords = 0;
    let totalDuration = 0;
    let totalHesitations = 0;
    let totalRepeatedWords = 0;
    
    config.speechMetadata.forEach(data => {
        totalWords += data.wordCount;
        totalDuration += parseFloat(data.durationSeconds);
        totalHesitations += data.hesitationMarkers;
        totalRepeatedWords += data.repeatedWords;
    });
    
    const avgWPM = Math.round((totalWords / totalDuration) * 60);
    
    return `Speech Metadata Summary:
- Total responses: ${config.speechMetadata.length}
- Average speaking rate: ${avgWPM} words per minute
- Total hesitation markers: ${totalHesitations}
- Repeated words: ${totalRepeatedWords}
- Speaking fluidity: ${totalHesitations <= 5 ? "Very fluid" : totalHesitations <= 15 ? "Moderately fluid" : "Less fluid with noticeable hesitations"}`;
}

function saveSettings() {
    config.conversationModel = conversationModelInput.value.trim();
    config.scoringModel = scoringModelInput.value.trim();
    config.ollamaEndpoint = ollamaEndpointInput.value.trim();
    
    localStorage.setItem('ieltsExaminerSettings', JSON.stringify({
        conversationModel: config.conversationModel,
        scoringModel: config.scoringModel,
        ollamaEndpoint: config.ollamaEndpoint
    }));
    
    updateStatus('Settings saved successfully.');
}

function loadSettings() {
    const savedSettings = localStorage.getItem('ieltsExaminerSettings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        config.conversationModel = parsedSettings.conversationModel || 'gemma3:4b';
        config.scoringModel = parsedSettings.scoringModel || 'deepseek:1.5b';
        config.ollamaEndpoint = parsedSettings.ollamaEndpoint || 'http://localhost:11434';
        
        conversationModelInput.value = config.conversationModel;
        scoringModelInput.value = config.scoringModel;
        ollamaEndpointInput.value = config.ollamaEndpoint;
    }
}

function attachEventListeners() {
    sendButton.addEventListener('click', () => sendMessage());
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    startRecordingButton.addEventListener('click', startRecording);
    stopRecordingButton.addEventListener('click', stopRecording);
    stopSpeakingButton.addEventListener('click', stopSpeaking);
    scoreButton.addEventListener('click', requestScoring);
    
    startTestButton.addEventListener('click', startTest);
    testPartSelector.addEventListener('change', (e) => {
        config.currentTestPart = parseInt(e.target.value);
    });
    
    // saveSettingsButton.addEventListener('click', saveSettings);
}