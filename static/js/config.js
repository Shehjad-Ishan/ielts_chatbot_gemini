// config.js - Configuration settings

// Global configuration object
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
    currentAudio: null,
    messageSent: false,
    speechMetadata: [],
    testPrompts: {
        systemPrompt: `You are an IELTS speaking examiner. You should evaluate the student's English speaking ability 
                      according to the IELTS criteria: Fluency and Coherence, Lexical Resource, Grammatical Range 
                      and Accuracy, and Pronunciation. Keep your responses concise and natural like a real examiner. 
                      Do not provide scores during the test, only at the end when explicitly asked. Do not use any emoji in the reponses.`,
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
    }
};

// Initialize configuration
export function initConfig() {
    return config;
}

// Get current configuration
export function getConfig() {
    return config;
}

// Update configuration
export function updateConfig(newConfig) {
    config = { ...config, ...newConfig };
    return config;
}