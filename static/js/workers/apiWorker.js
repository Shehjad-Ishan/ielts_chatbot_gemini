// apiWorker.js - Web worker for API calls

// Request timeout handler
function createTimeoutPromise(ms) {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
    });
}

self.addEventListener('message', async (e) => {
    const data = e.data;
    
    switch (data.type) {
        case 'chatRequest':
            await handleChatRequest(data.payload);
            break;
            
        case 'ttsRequest':
            await handleTTSRequest(data.payload);
            break;
            
        default:
            self.postMessage({
                type: 'error',
                error: 'Unknown request type'
            });
    }
});

async function handleChatRequest(payload) {
    try {
        const timeoutPromise = createTimeoutPromise(120000); // 2 minutes timeout
        
        const fetchPromise = fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: payload.model,
                messages: payload.messages,
                endpoint: payload.endpoint
            })
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        self.postMessage({
            type: 'chatResponse',
            response: data.response,
            isScoring: payload.isScoring
        });
        
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message
        });
    }
}

async function handleTTSRequest(payload) {
    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: payload.text,
                voice: payload.voice
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        self.postMessage({
            type: 'ttsResponse',
            audio: data.audio,
            text: payload.text
        });
        
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message
        });
    }
}