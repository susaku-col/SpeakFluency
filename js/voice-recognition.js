// ============ VOICE RECOGNITION (Speech to Text) ============
let pronunciationRecognition = null;
let voiceRecognition = null;
let isRecording = false;
let isThinking = false;
let onVoiceResultCallback = null;

function initPronunciationRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        pronunciationRecognition = new SpeechRecognition();
        pronunciationRecognition.lang = 'en-US';
        pronunciationRecognition.continuous = false;
        pronunciationRecognition.interimResults = false;
        
        pronunciationRecognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            if (onPronunciationResult) onPronunciationResult(transcript);
        };
        
        pronunciationRecognition.onerror = function(event) {
            console.error('Pronunciation error:', event.error);
            if (onPronunciationError) onPronunciationError(event.error);
        };
        return true;
    }
    return false;
}

function initVoiceChatRecognition(onResult, onError, onStart, onEnd) {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceRecognition = new SpeechRecognition();
        voiceRecognition.lang = 'en-US';
        voiceRecognition.continuous = false;
        voiceRecognition.interimResults = false;
        
        voiceRecognition.onstart = function() {
            isRecording = true;
            if (onStart) onStart();
        };
        
        voiceRecognition.onend = function() {
            isRecording = false;
            if (onEnd) onEnd();
        };
        
        voiceRecognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            if (onResult) onResult(transcript);
        };
        
        voiceRecognition.onerror = function(event) {
            if (onError) onError(event.error);
        };
        return true;
    }
    return false;
}

function startPronunciationRecording() {
    if (pronunciationRecognition) {
        pronunciationRecognition.start();
        return true;
    }
    return false;
}

function startVoiceRecording() {
    if (voiceRecognition && !isRecording && !isThinking) {
        voiceRecognition.start();
        return true;
    }
    return false;
}

function stopVoiceRecording() {
    if (voiceRecognition && isRecording) {
        voiceRecognition.stop();
        return true;
    }
    return false;
}

// Callback handlers
let onPronunciationResult = null;
let onPronunciationError = null;

function setPronunciationCallbacks(onResult, onError) {
    onPronunciationResult = onResult;
    onPronunciationError = onError;
}
