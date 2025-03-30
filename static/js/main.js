// main.js - Entry point with multithreading

import { initConfig } from './config.js';
import { initializeSpeechRecognition } from './modules/speechRecognition.js';
import { attachEventListeners } from './modules/messaging.js';
import { loadSettings } from './modules/settings.js';

// Initialize web workers
const punctuationWorker = new Worker('./js/workers/punctuationWorker.js');
const apiWorker = new Worker('./js/workers/apiWorker.js');

// Set up worker message handlers
punctuationWorker.onmessage = function(e) {
    if (e.data.type === 'punctuationResult') {
        // Handle punctuated text
        document.dispatchEvent(new CustomEvent('punctuationProcessed', {
            detail: { text: e.data.text, originalText: e.data.originalText }
        }));
    } else if (e.data.type === 'error') {
        console.error('Punctuation worker error:', e.data.error);
    }
};

apiWorker.onmessage = function(e) {
    if (e.data.type === 'chatResponse') {
        // Handle chat response
        document.dispatchEvent(new CustomEvent('chatResponseReceived', {
            detail: { response: e.data.response }
        }));
    } else if (e.data.type === 'ttsResponse') {
        // Handle TTS response
        document.dispatchEvent(new CustomEvent('ttsResponseReceived', {
            detail: { audio: e.data.audio }
        }));
    } else if (e.data.type === 'error') {
        console.error('API worker error:', e.data.error);
        document.dispatchEvent(new CustomEvent('apiError', {
            detail: { message: e.data.error }
        }));
    }
};

// Export workers for use in other modules
export const workers = {
    punctuation: punctuationWorker,
    api: apiWorker
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize configuration
    initConfig();
    
    // Initialize speech recognition
    initializeSpeechRecognition();
    
    // Load user settings
    loadSettings();
    
    // Attach event listeners
    attachEventListeners();
    
    console.log('IELTS Speaking Test Application initialized');
});