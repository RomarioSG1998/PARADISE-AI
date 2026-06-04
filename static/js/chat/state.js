export const state = {
    isConfigured: false,
    isActive: false,
    chatHistory: [],
    
    // Mic Recording variables
    mediaRecorder: null,
    audioChunks: [],
    voiceSpeechRecognition: null,
    recordedTranscript: '',
    isMicRecording: false,

    // Voice mode variables
    audioCtx: null,
    analyser: null,
    micStream: null,
    visualizerAnimationId: null,
    ttsAudioElement: null,
    wordRevealInterval: null,
    voiceRecognition: null,
    voiceActive: false,
    isMuted: false,
    isAiSpeaking: false
};
