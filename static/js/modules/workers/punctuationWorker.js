// punctuationWorker.js - Web worker for punctuation processing

self.addEventListener('message', async (e) => {
    const data = e.data;
    
    if (data.type === 'processPunctuation') {
        try {
            const punctuatedText = await processPunctuation(data.text);
            
            self.postMessage({
                type: 'punctuationResult',
                text: punctuatedText,
                originalText: data.text,
                endOfRecording: data.endOfRecording,
                recordingStartTime: data.recordingStartTime
            });
        } catch (error) {
            self.postMessage({
                type: 'error',
                error: error.message
            });
        }
    }
});

async function processPunctuation(text) {
    try {
        const response = await fetch('/api/punctuate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error('Error processing punctuation:', error);
        return text; // Return original text if there's an error
    }
}