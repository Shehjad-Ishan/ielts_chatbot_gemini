// test.js - Test management

import { getConfig, updateConfig } from '../config.js';
import { addMessage, updateStatus } from './messaging.js';
import { speakText } from './tts.js';
import { startTimer } from './timer.js';

export function startTest() {
    const config = getConfig();
    const chatContainer = document.getElementById('chatContainer');
    
    // Clear the chat container
    chatContainer.innerHTML = '';
    
    // Update config
    updateConfig({
        testActive: true,
        speechMetadata: [],
        messageSent: false
    });
    
    // Start the timer
    startTimer();
    
    // Generate intro message based on selected test part
    let introMessage = generateIntroMessage(config.currentTestPart);
    
    // Add message and speak
    addMessage(introMessage, 'examiner');
    speakText(introMessage);
    
    // Update status and enable score button
    updateStatus('Test started. Please respond to the examiner.');
    document.getElementById('scoreButton').disabled = false;
}

function generateIntroMessage(testPart) {
    const config = getConfig();
    
    switch (testPart) {
        case 1:
            return config.testPrompts.part1.intro;
            
        case 2:
            const part2Topics = config.testPrompts.part2.topics;
            const randomTopic = part2Topics[Math.floor(Math.random() * part2Topics.length)];
            return config.testPrompts.part2.intro + " " + randomTopic;
            
        case 3:
            const topicKeys = Object.keys(config.testPrompts.part3.topics);
            const selectedTopic = topicKeys[Math.floor(Math.random() * topicKeys.length)];
            return config.testPrompts.part3.intro + " " + 
                  config.testPrompts.part3.topics[selectedTopic][0];
            
        default:
            return config.testPrompts.part1.intro;
    }
}