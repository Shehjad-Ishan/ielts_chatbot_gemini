// messaging.js - Message handling and display

import { getConfig, updateConfig } from '../config.js';
import { workers } from '../main.js';
import { speakText } from './tts.js';
import { startRecording, stopRecording } from './speechRecognition.js';
import { stopSpeaking } from './tts.js';
import { requestScoring } from './scoring.js';
import { startTest } from './test.js';
import { saveSettings } from './settings.js';

export function attachEventListeners() {
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const startRecordingButton = document.getElementById('startRecordingButton');
    const stopRecordingButton = document.getElementById('stopRecordingButton');
    const stopSpeakingButton = document.getElementById('stopSpeakingButton');
    const scoreButton = document.getElementById('scoreButton');
    const startTestButton = document.getElementById('startTestButton');
    const testPartSelector = document.getElementById('testPartSelector');
    const saveSettingsButton = document.getElementById('saveSettingsButton');
    
    // Message sending event listeners
    sendButton.addEventListener('click', () => sendMessage());
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Recording control event listeners
    startRecordingButton.addEventListener('click', startRecording);
    stopRecordingButton.addEventListener('click', stopRecording);
    stopSpeakingButton.addEventListener('click', stopSpeaking);
    
    // Test control event listeners
    scoreButton.addEventListener('click', requestScoring);
    startTestButton.addEventListener('click', startTest);
    testPartSelector.addEventListener('change', (e) => {
        updateConfig({ currentTestPart: parseInt(e.target.value) });
    });
    
    // Settings event listeners
    // saveSettingsButton.addEventListener('click', saveSettings);
    
    // API response handlers
    document.addEventListener('chatResponseReceived', (e) => {
        addMessage(e.detail.response, 'examiner');
        if (!e.detail.isScoring) {
            speakText(e.detail.response);
        } else {
            updateStatus('Scoring complete.');
        }
    });
    
    document.addEventListener('apiError', (e) => {
        updateStatus(`Error: ${e.detail.message}. Please try again with a shorter response or check your connection.`);
        
        document.getElementById('startRecordingButton').disabled = false;
        document.getElementById('sendButton').disabled = false;
        document.getElementById('userInput').disabled = false;
    });
}

export function sendMessage(isScoring = false, customPrompt = null) {
    const config = getConfig();
    const userMessage = customPrompt || document.getElementById('userInput').value.trim();
    
    if (!userMessage) return;
    
    if (!isScoring || !customPrompt) {
        addMessage(userMessage, 'user');
    }
    
    document.getElementById('userInput').value = '';
    updateStatus(`Waiting for response using ${isScoring ? config.scoringModel : config.conversationModel}...`);
    
    const history = getConversationHistory();
    const systemPrompt = config.testPrompts.systemPrompt;
    const modelToUse = isScoring ? config.scoringModel : config.conversationModel;
    
    // Send request to API worker
    workers.api.postMessage({
        type: 'chatRequest',
        payload: {
            model: modelToUse,
            messages: [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userMessage }
            ],
            endpoint: config.ollamaEndpoint,
            isScoring: isScoring
        }
    });
    
    // Disable UI elements while waiting for response
    document.getElementById('startRecordingButton').disabled = true;
    document.getElementById('sendButton').disabled = true;
    document.getElementById('userInput').disabled = true;
}

export function addMessage(message, sender) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    messageDiv.textContent = message;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

export function getConversationHistory() {
    const chatContainer = document.getElementById('chatContainer');
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

export function updateStatus(message) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
}