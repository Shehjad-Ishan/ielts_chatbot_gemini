// scoring.js - Scoring functionality

import { getConfig, updateConfig } from '../config.js';
import { addMessage, sendMessage, updateStatus } from './messaging.js';

export function requestScoring() {
    const config = getConfig();
    
    // Generate metadata summary
    const metadataSummary = generateMetadataSummary();
    
    // Compose scoring prompt
    const scoringPrompt = config.testPrompts.scoringPrompt + "\n\n" + metadataSummary;
    
    // Update status
    updateStatus('Generating IELTS scores using ' + config.scoringModel + '...');
    
    // Add user message
    addMessage("Please evaluate my speaking test performance and provide scores.", 'user');
    
    // Send scoring request
    sendMessage(true, scoringPrompt);
}

export function collectSpeechMetadata(transcript, startTime) {
    const config = getConfig();
    
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
        
        const updatedMetadata = [...config.speechMetadata, metadata];
        updateConfig({ speechMetadata: updatedMetadata });
    }, 0);
}

export function generateMetadataSummary() {
    const config = getConfig();
    
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