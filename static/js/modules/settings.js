// settings.js - Settings management

import { getConfig, updateConfig } from '../config.js';
import { updateStatus } from './messaging.js';

export function saveSettings() {
    const conversationModelInput = document.getElementById('conversationModel');
    const scoringModelInput = document.getElementById('scoringModel');
    const ollamaEndpointInput = document.getElementById('ollamaEndpoint');
    
    const conversationModel = conversationModelInput.value.trim();
    const scoringModel = scoringModelInput.value.trim();
    const ollamaEndpoint = ollamaEndpointInput.value.trim();
    
    updateConfig({
        conversationModel,
        scoringModel,
        ollamaEndpoint
    });
    
    localStorage.setItem('ieltsExaminerSettings', JSON.stringify({
        conversationModel,
        scoringModel,
        ollamaEndpoint
    }));
    
    updateStatus('Settings saved successfully.');
}

export function loadSettings() {
    const savedSettings = localStorage.getItem('ieltsExaminerSettings');
    
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        
        const conversationModel = parsedSettings.conversationModel || 'gemma3:4b';
        const scoringModel = parsedSettings.scoringModel || 'gemma3:4b';
        const ollamaEndpoint = parsedSettings.ollamaEndpoint || 'http://localhost:11434';
        
        updateConfig({
            conversationModel,
            scoringModel,
            ollamaEndpoint
        });
        
        document.getElementById('conversationModel').value = conversationModel;
        document.getElementById('scoringModel').value = scoringModel;
        document.getElementById('ollamaEndpoint').value = ollamaEndpoint;
    }
}