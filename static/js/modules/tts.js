// tts.js - Text-to-speech functionality

import { getConfig, updateConfig } from '../config.js';
import { workers } from '../main.js';
import { updateStatus } from './messaging.js';

export function speakText(text) {
    updateStatus('Generating speech...');
    
    // Disable UI elements during speech generation/playback
    document.getElementById('startRecordingButton').disabled = true;
    document.getElementById('sendButton').disabled = true;
    document.getElementById('userInput').disabled = true;
    document.getElementById('stopSpeakingButton').disabled = false;
    
    // Send TTS request to API worker
    workers.api.postMessage({
        type: 'ttsRequest',
        payload: {
            text: text,
            voice: 'default'
        }
    });
    
    // Set up event listener for TTS response
    document.addEventListener('ttsResponseReceived', handleTTSResponse);
}

function handleTTSResponse(e) {
    const audioData = e.detail.audio;
    
    try {
        const audio = new Audio(`data:audio/wav;base64,${audioData}`);
        updateConfig({ currentAudio: audio });
        
        audio.onplay = () => {
            updateStatus('Examiner is speaking...');
        };
        
        audio.onended = () => {
            updateStatus('Ready for your response.');
            document.getElementById('stopSpeakingButton').disabled = true;
            updateConfig({ currentAudio: null });
            document.getElementById('startRecordingButton').disabled = false;
            document.getElementById('sendButton').disabled = false;
            document.getElementById('userInput').disabled = false;
        };
        
        audio.onerror = () => {
            updateStatus('Error playing audio.');
            document.getElementById('stopSpeakingButton').disabled = true;
            updateConfig({ currentAudio: null });
            document.getElementById('startRecordingButton').disabled = false;
            document.getElementById('sendButton').disabled = false;
            document.getElementById('userInput').disabled = false;
        };
        
        audio.play();
        
    } catch (error) {
        console.error('Error with TTS playback:', error);
        fallbackToBuiltInTTS(e.detail.text);
    }
    
    // Remove the event listener to avoid duplicates
    document.removeEventListener('ttsResponseReceived', handleTTSResponse);
}

function fallbackToBuiltInTTS(text) {
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
            document.getElementById('stopSpeakingButton').disabled = true;
            document.getElementById('startRecordingButton').disabled = false;
            document.getElementById('sendButton').disabled = false;
            document.getElementById('userInput').disabled = false;
        };
        
        updateConfig({
            currentAudio: {
                pause: () => {
                    window.speechSynthesis.cancel();
                },
                currentTime: 0
            }
        });
        
        window.speechSynthesis.speak(speech);
    }
}

export function stopSpeaking() {
    const config = getConfig();
    
    if (config.currentAudio) {
        config.currentAudio.pause();
        config.currentAudio.currentTime = 0;
        updateConfig({ currentAudio: null });
        
        document.getElementById('stopSpeakingButton').disabled = true;
        updateStatus('Playback stopped.');
        
        document.getElementById('startRecordingButton').disabled = false;
        document.getElementById('sendButton').disabled = false;
        document.getElementById('userInput').disabled = false;
    }
}