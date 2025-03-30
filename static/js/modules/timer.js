// timer.js - Timer functionality

import { getConfig, updateConfig } from '../config.js';

export function startTimer() {
    const timerElement = document.getElementById('timer');
    timerElement.classList.remove('d-none');
    
    updateConfig({ timerSeconds: 0 });
    updateTimerDisplay();
    
    const timerInterval = setInterval(() => {
        const config = getConfig();
        updateConfig({ timerSeconds: config.timerSeconds + 1 });
        updateTimerDisplay();
    }, 1000);
    
    updateConfig({ timerInterval });
}

export function stopTimer() {
    const config = getConfig();
    
    if (config.timerInterval) {
        clearInterval(config.timerInterval);
        updateConfig({ timerInterval: null });
    }
}

export function updateTimerDisplay() {
    const config = getConfig();
    const timerElement = document.getElementById('timer');
    
    const minutes = Math.floor(config.timerSeconds / 60);
    const seconds = config.timerSeconds % 60;
    
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}