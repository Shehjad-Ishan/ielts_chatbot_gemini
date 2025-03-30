// speechRecognition.js - Speech recognition functionality

import { getConfig, updateConfig } from '../config.js';
import { workers } from '../main.js';
import { addMessage, sendMessage, updateStatus } from './messaging.js';
import { collectSpeechMetadata } from './scoring.js';

export function initializeSpeechRecognition() {
    const config = getConfig();
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';
        
        setupRecognitionHandlers(recognition);
        
        updateConfig({ recognition });
    } else {
        updateStatus('Speech recognition is not supported in your browser.');
        document.getElementById('startRecordingButton').disabled = true;
    }
}

function setupRecognitionHandlers(recognition) {
    let hasSpeechDetected = false;
    let silenceTimer = null;
    const SILENCE_THRESHOLD = 60000; // 1 minute silence threshold
    let recordingStartTime = 0;
    let lastSpeechTimestamp = 0;
    let tempMessageElement = null;
    let fullTranscript = '';
    
    recognition.onstart = () => {
        const config = getConfig();
        updateStatus('Listening... Speak now.');
        
        hasSpeechDetected = false;
        recordingStartTime = Date.now();
        lastSpeechTimestamp = recordingStartTime;
        
        updateConfig({
            pauseCount: 0,
            lastTimerValue: config.timerSeconds,
            messageSent: false
        });
        
        fullTranscript = '';
        
        document.getElementById('startRecordingButton').disabled = true;
        document.getElementById('stopRecordingButton').disabled = false;
        
        tempMessageElement = document.createElement('div');
        tempMessageElement.classList.add('message', 'user', 'temp-message');
        tempMessageElement.textContent = '...';
        document.getElementById('chatContainer').appendChild(tempMessageElement);
        document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
    };
    
    recognition.onresult = (event) => {
        const config = getConfig();
        fullTranscript = '';
        
        // Just collect the transcript without punctuation during recording
        for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript + ' ';
        }
        
        fullTranscript = fullTranscript.trim();
        document.getElementById('userInput').value = fullTranscript;
        
        if (tempMessageElement) {
            tempMessageElement.textContent = fullTranscript;
            document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight;
        }
        
        const currentTime = Date.now();
        if (!hasSpeechDetected) {
            hasSpeechDetected = true;
        } else if (currentTime - lastSpeechTimestamp > 1500) {
            updateConfig({ pauseCount: config.pauseCount + 1 });
        }
        lastSpeechTimestamp = currentTime;
        
        // Send the transcript for punctuation processing in the background
        if (silenceTimer) {
            clearTimeout(silenceTimer);
        }
        
        silenceTimer = setTimeout(() => {
            if (hasSpeechDetected && !config.messageSent) {
                // Process punctuation and send message
                workers.punctuation.postMessage({
                    type: 'processPunctuation',
                    text: fullTranscript
                });
                
                updateConfig({ messageSent: true });
                stopRecording();
            }
        }, SILENCE_THRESHOLD);
    };
    
    recognition.onend = () => {
        const config = getConfig();
        
        document.getElementById('startRecordingButton').disabled = false;
        document.getElementById('stopRecordingButton').disabled = true;
        updateStatus('Recording stopped.');
        
        if (silenceTimer) {
            clearTimeout(silenceTimer);
        }
        
        if (hasSpeechDetected && fullTranscript.trim() !== '' && !config.messageSent) {
            // Process punctuation at the end of recording
            workers.punctuation.postMessage({
                type: 'processPunctuation',
                text: fullTranscript,
                endOfRecording: true,
                recordingStartTime: recordingStartTime
            });
            
            updateConfig({ messageSent: true });
        } else {
            if (tempMessageElement) {
                tempMessageElement.remove();
                tempMessageElement = null;
            }
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        updateStatus('Error with speech recognition: ' + event.error);
        
        if (tempMessageElement) {
            tempMessageElement.remove();
            tempMessageElement = null;
        }
        
        stopRecording();
    };
    
    // Handle punctuation processing result
    document.addEventListener('punctuationProcessed', (e) => {
        const punctuatedText = e.detail.text;
        
        if (tempMessageElement) {
            tempMessageElement.remove();
            tempMessageElement = null;
        }
        
        document.getElementById('userInput').value = punctuatedText;
        sendMessage(false, punctuatedText);
        
        setTimeout(() => {
            collectSpeechMetadata(punctuatedText, recordingStartTime);
        }, 0);
    });
}

export function startRecording() {
    const config = getConfig();
    
    if (config.recognition) {
        try {
            if (config.currentAudio) {
                // Import stopSpeaking from tts.js at the top of this file to avoid circular imports
                import('./tts.js').then(module => {
                    module.stopSpeaking();
                });
            }
            
            document.getElementById('userInput').value = '';
            config.recognition.start();
        } catch (error) {
            console.error('Error starting recognition', error);
            updateStatus('Error starting speech recognition.');
        }
    }
}

export function stopRecording() {
    const config = getConfig();
    
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