// endpoints.js - API endpoints configuration

export const endpoints = {
    chat: '/api/chat',
    tts: '/api/tts',
    punctuate: '/api/punctuate'
};

export const defaultConfig = {
    chatTimeout: 120000,  // 2 minutes
    ttsTimeout: 30000,    // 30 seconds
    punctuateTimeout: 15000  // 15 seconds
};

export function getEndpointUrl(endpoint) {
    return endpoints[endpoint] || null;
}