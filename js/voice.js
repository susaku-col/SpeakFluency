// ============================================
// SpeakFlow Voice Module
// Voice Recording & Recognition
// ============================================

// ============================================
// Voice State Management
// ============================================

const VoiceState = {
    isRecording: false,
    isPlaying: false,
    isSupported: true,
    mediaRecorder: null,
    audioChunks: [],
    audioContext: null,
    analyser: null,
    mediaStream: null,
    currentAudio: null,
    recordingStartTime: null,
    recordingDuration: 0,
    audioLevel: 0,
    volumeInterval: null,
    selectedDevice: null,
    availableDevices: []
};

// ============================================
// DOM Elements
// ============================================

const VoiceDOM = {
    recordBtn: document.getElementById('voice-record-btn'),
    stopBtn: document.getElementById('voice-stop-btn'),
    playBtn: document.getElementById('voice-play-btn'),
    audioLevel: document.getElementById('audio-level'),
    timer: document.getElementById('recording-timer'),
    waveform: document.getElementById('waveform-canvas'),
    deviceSelect: document.getElementById('audio-device-select'),
    volumeMeter: document.getElementById('volume-meter')
};

// ============================================
// Audio Visualization
// ============================================

let waveformCanvas = null;
let waveformCtx = null;
let animationId = null;

/**
 * Initialize waveform canvas
 */
const initWaveform = () => {
    const canvas = VoiceDOM.waveform || document.getElementById('waveform-canvas');
    if (canvas) {
        waveformCanvas = canvas;
        waveformCtx = canvas.getContext('2d');
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
};

/**
 * Draw waveform from audio data
 */
const drawWaveform = (dataArray, bufferLength) => {
    if (!waveformCtx || !waveformCanvas) return;
    
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    const sliceWidth = width / bufferLength;
    
    waveformCtx.clearRect(0, 0, width, height);
    waveformCtx.beginPath();
    waveformCtx.strokeStyle = '#4F46E5';
    waveformCtx.lineWidth = 2;
    
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        
        if (i === 0) {
            waveformCtx.moveTo(x, y);
        } else {
            waveformCtx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    
    waveformCtx.stroke();
};

/**
 * Visualize audio from microphone
 */
const visualizeAudio = () => {
    if (!VoiceState.analyser || !VoiceState.isRecording) return;
    
    const bufferLength = VoiceState.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
        if (!VoiceState.isRecording) return;
        
        animationId = requestAnimationFrame(draw);
        VoiceState.analyser.getByteTimeDomainData(dataArray);
        drawWaveform(dataArray, bufferLength);
        
        // Calculate volume level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128 - 1;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / bufferLength) || 0;
        VoiceState.audioLevel = Math.min(1, rms * 2);
        
        updateVolumeMeter(VoiceState.audioLevel);
    };
    
    draw();
};

/**
 * Update volume meter UI
 */
const updateVolumeMeter = (level) => {
    const volumeMeter = VoiceDOM.volumeMeter || document.getElementById('volume-meter');
    if (volumeMeter) {
        const percentage = level * 100;
        volumeMeter.style.width = `${percentage}%`;
        
        // Change color based on level
        if (percentage > 80) {
            volumeMeter.style.backgroundColor = '#ef4444';
        } else if (percentage > 50) {
            volumeMeter.style.backgroundColor = '#f59e0b';
        } else {
            volumeMeter.style.backgroundColor = '#10b981';
        }
    }
    
    // Update audio level bar
    const audioLevel = VoiceDOM.audioLevel || document.getElementById('audio-level');
    if (audioLevel) {
        audioLevel.style.width = `${level * 100}%`;
    }
};

/**
 * Update recording timer
 */
const updateRecordingTimer = () => {
    if (!VoiceState.isRecording || !VoiceState.recordingStartTime) return;
    
    const duration = (Date.now() - VoiceState.recordingStartTime) / 1000;
    VoiceState.recordingDuration = duration;
    
    const timer = VoiceDOM.timer || document.getElementById('recording-timer');
    if (timer) {
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Auto-stop after 60 seconds
    if (duration >= 60) {
        stopRecording();
    }
};

// ============================================
// Device Management
// ============================================

/**
 * Get available audio devices
 */
const getAudioDevices = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        VoiceState.availableDevices = audioInputs;
        
        // Populate device select dropdown
        const deviceSelect = VoiceDOM.deviceSelect || document.getElementById('audio-device-select');
        if (deviceSelect && audioInputs.length > 0) {
            deviceSelect.innerHTML = `
                <option value="">Default Microphone</option>
                ${audioInputs.map(device => `
                    <option value="${device.deviceId}" ${VoiceState.selectedDevice === device.deviceId ? 'selected' : ''}>
                        ${device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                    </option>
                `).join('')}
            `;
            
            deviceSelect.addEventListener('change', (e) => {
                VoiceState.selectedDevice = e.target.value || null;
            });
        }
        
        return audioInputs;
    } catch (error) {
        console.error('Error getting audio devices:', error);
        return [];
    }
};

/**
 * Check microphone permission
 */
const checkMicrophonePermission = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        return false;
    }
};

// ============================================
// Recording Functions
// ============================================

/**
 * Start recording
 */
const startRecording = async () => {
    if (VoiceState.isRecording) {
        stopRecording();
        return;
    }
    
    try {
        // Check if browser supports mediaDevices
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Your browser does not support audio recording');
        }
        
        // Request microphone access
        const constraints = {
            audio: {
                deviceId: VoiceState.selectedDevice ? { exact: VoiceState.selectedDevice } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 16000,
                channelCount: 1
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        VoiceState.mediaStream = stream;
        
        // Setup audio context for visualization
        VoiceState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        VoiceState.analyser = VoiceState.audioContext.createAnalyser();
        VoiceState.analyser.fftSize = 256;
        
        const source = VoiceState.audioContext.createMediaStreamSource(stream);
        source.connect(VoiceState.analyser);
        
        // Initialize MediaRecorder
        VoiceState.mediaRecorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
        });
        
        VoiceState.audioChunks = [];
        
        VoiceState.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                VoiceState.audioChunks.push(event.data);
            }
        };
        
        VoiceState.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(VoiceState.audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Create audio element for playback
            const audio = new Audio(audioUrl);
            VoiceState.currentAudio = audio;
            
            // Dispatch event with recorded audio
            window.dispatchEvent(new CustomEvent('recording:complete', {
                detail: {
                    blob: audioBlob,
                    url: audioUrl,
                    duration: VoiceState.recordingDuration,
                    audio: audio
                }
            }));
        };
        
        VoiceState.mediaRecorder.start(100); // Collect data every 100ms
        VoiceState.isRecording = true;
        VoiceState.recordingStartTime = Date.now();
        VoiceState.recordingDuration = 0;
        
        // Start audio context
        await VoiceState.audioContext.resume();
        
        // Start visualization
        visualizeAudio();
        
        // Start timer
        if (VoiceState.volumeInterval) {
            clearInterval(VoiceState.volumeInterval);
        }
        VoiceState.volumeInterval = setInterval(updateRecordingTimer, 100);
        
        // Update UI
        updateRecordingUI(true);
        
        // Dispatch recording started event
        window.dispatchEvent(new CustomEvent('recording:start'));
        
        showToast('Recording started...', 'info', 'Recording');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        
        let errorMessage = 'Failed to start recording. ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow microphone access.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No microphone found.';
        } else {
            errorMessage += error.message;
        }
        
        showToast(errorMessage, 'error', 'Recording Error');
        VoiceState.isSupported = false;
    }
};

/**
 * Stop recording
 */
const stopRecording = () => {
    if (!VoiceState.isRecording) return;
    
    if (VoiceState.mediaRecorder && VoiceState.mediaRecorder.state === 'recording') {
        VoiceState.mediaRecorder.stop();
    }
    
    if (VoiceState.mediaStream) {
        VoiceState.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (VoiceState.audioContext) {
        VoiceState.audioContext.close();
    }
    
    if (VoiceState.volumeInterval) {
        clearInterval(VoiceState.volumeInterval);
    }
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    VoiceState.isRecording = false;
    VoiceState.mediaRecorder = null;
    VoiceState.mediaStream = null;
    VoiceState.audioContext = null;
    VoiceState.analyser = null;
    
    // Update UI
    updateRecordingUI(false);
    
    // Dispatch recording stopped event
    window.dispatchEvent(new CustomEvent('recording:stop', {
        detail: { duration: VoiceState.recordingDuration }
    }));
    
    showToast('Recording stopped', 'info', 'Recording');
};

/**
 * Update recording UI
 */
const updateRecordingUI = (isRecording) => {
    const recordBtn = VoiceDOM.recordBtn || document.getElementById('voice-record-btn');
    const stopBtn = VoiceDOM.stopBtn || document.getElementById('voice-stop-btn');
    const playBtn = VoiceDOM.playBtn || document.getElementById('voice-play-btn');
    
    if (recordBtn) {
        recordBtn.style.display = isRecording ? 'none' : 'inline-flex';
        recordBtn.disabled = isRecording;
    }
    
    if (stopBtn) {
        stopBtn.style.display = isRecording ? 'inline-flex' : 'none';
    }
    
    if (playBtn) {
        playBtn.disabled = !VoiceState.currentAudio;
    }
    
    // Add recording animation class
    const recordingIndicator = document.getElementById('recording-indicator');
    if (recordingIndicator) {
        if (isRecording) {
            recordingIndicator.classList.add('active');
        } else {
            recordingIndicator.classList.remove('active');
        }
    }
};

// ============================================
// Playback Functions
// ============================================

/**
 * Play recorded audio
 */
const playRecording = () => {
    if (!VoiceState.currentAudio) {
        showToast('No recording to play', 'warning', 'Playback');
        return;
    }
    
    if (VoiceState.isPlaying) {
        stopPlayback();
        return;
    }
    
    VoiceState.currentAudio.onplay = () => {
        VoiceState.isPlaying = true;
        updatePlaybackUI(true);
        window.dispatchEvent(new CustomEvent('playback:start'));
    };
    
    VoiceState.currentAudio.onended = () => {
        stopPlayback();
    };
    
    VoiceState.currentAudio.onerror = () => {
        showToast('Error playing audio', 'error', 'Playback Error');
        stopPlayback();
    };
    
    VoiceState.currentAudio.play();
};

/**
 * Stop playback
 */
const stopPlayback = () => {
    if (VoiceState.currentAudio) {
        VoiceState.currentAudio.pause();
        VoiceState.currentAudio.currentTime = 0;
    }
    
    VoiceState.isPlaying = false;
    updatePlaybackUI(false);
    window.dispatchEvent(new CustomEvent('playback:stop'));
};

/**
 * Update playback UI
 */
const updatePlaybackUI = (isPlaying) => {
    const playBtn = VoiceDOM.playBtn || document.getElementById('voice-play-btn');
    if (playBtn) {
        playBtn.textContent = isPlaying ? '⏸️' : '▶️';
        playBtn.classList.toggle('playing', isPlaying);
    }
};

// ============================================
// Audio Processing
// ============================================

/**
 * Convert blob to base64
 */
const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Get audio duration from blob
 */
const getAudioDuration = (blob) => {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
        });
        audio.src = URL.createObjectURL(blob);
    });
};

/**
 * Trim audio (basic implementation)
 */
const trimAudio = async (blob, startSeconds, endSeconds) => {
    // In production, use Web Audio API or backend service
    return blob;
};

/**
 * Normalize audio volume
 */
const normalizeAudio = async (blob) => {
    // In production, use Web Audio API
    return blob;
};

// ============================================
// Speech Recognition
// ============================================

let recognition = null;
let isRecognizing = false;

/**
 * Initialize speech recognition
 */
const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
        return null;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        isRecognizing = true;
        window.dispatchEvent(new CustomEvent('recognition:start'));
    };
    
    recognition.onend = () => {
        isRecognizing = false;
        window.dispatchEvent(new CustomEvent('recognition:end'));
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        window.dispatchEvent(new CustomEvent('recognition:error', { detail: { error: event.error } }));
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        window.dispatchEvent(new CustomEvent('recognition:result', {
            detail: {
                final: finalTranscript,
                interim: interimTranscript,
                isFinal: !!finalTranscript
            }
        }));
    };
    
    return recognition;
};

/**
 * Start speech recognition
 */
const startSpeechRecognition = () => {
    if (!recognition) {
        initSpeechRecognition();
    }
    
    if (recognition && !isRecognizing) {
        try {
            recognition.start();
        } catch (error) {
            console.error('Error starting speech recognition:', error);
        }
    }
};

/**
 * Stop speech recognition
 */
const stopSpeechRecognition = () => {
    if (recognition && isRecognizing) {
        try {
            recognition.stop();
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
        }
    }
};

// ============================================
// Pronunciation Analysis
// ============================================

/**
 * Analyze pronunciation of recorded audio
 */
const analyzePronunciation = async (audioBlob, expectedText, language = 'en') => {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('expectedText', expectedText);
        formData.append('language', language);
        
        const response = await fetch('/api/voice/analyze', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.dispatchEvent(new CustomEvent('pronunciation:analyzed', {
                detail: data
            }));
            return data;
        } else {
            throw new Error(data.error || 'Analysis failed');
        }
    } catch (error) {
        console.error('Pronunciation analysis error:', error);
        showToast('Failed to analyze pronunciation', 'error', 'Analysis Error');
        return null;
    }
};

/**
 * Display pronunciation results
 */
const displayPronunciationResults = (results) => {
    const container = document.getElementById('pronunciation-results');
    if (!container) return;
    
    const { overallScore, level, feedback, details, mispronouncedWords, suggestions } = results;
    
    container.innerHTML = `
        <div class="pronunciation-score">
            <div class="score-circle" data-score="${overallScore}">
                <span class="score-value">${overallScore}</span>
                <span class="score-label">Overall Score</span>
            </div>
            <div class="score-level ${level}">${level.toUpperCase()}</div>
        </div>
        
        <div class="pronunciation-feedback">
            <p>${feedback}</p>
        </div>
        
        <div class="pronunciation-details">
            <div class="detail-item">
                <span class="detail-label">Accuracy</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${details.accuracy}%"></div>
                </div>
                <span class="detail-value">${details.accuracy}%</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Fluency</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${details.fluency}%"></div>
                </div>
                <span class="detail-value">${details.fluency}%</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Intonation</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${details.intonation}%"></div>
                </div>
                <span class="detail-value">${details.intonation}%</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Pace</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${details.pace}%"></div>
                </div>
                <span class="detail-value">${details.pace}%</span>
            </div>
        </div>
        
        ${mispronouncedWords && mispronouncedWords.length > 0 ? `
            <div class="mispronounced-words">
                <h4>Words to Practice</h4>
                <div class="word-list">
                    ${mispronouncedWords.map(word => `
                        <div class="word-item">
                            <span class="word">${word.expected}</span>
                            <span class="suggestion">${word.suggestion}</span>
                            <button class="btn-sm btn-outline" onclick="voice.playWord('${word.expected}')">Listen</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <div class="pronunciation-suggestions">
            <h4>Practice Tips</h4>
            <ul>
                ${suggestions.map(s => `<li>${s.message || s}</li>`).join('')}
            </ul>
        </div>
    `;
    
    // Animate score circle
    const scoreCircle = container.querySelector('.score-circle');
    if (scoreCircle) {
        const score = parseInt(scoreCircle.dataset.score);
        const circumference = 2 * Math.PI * 45;
        // Implementation for circle animation
    }
};

// ============================================
// Text-to-Speech
// ============================================

/**
 * Convert text to speech
 */
const textToSpeech = async (text, voice = 'nova', speed = 1.0) => {
    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({ text, voice, speed })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
            audio.play();
            return audio;
        } else {
            throw new Error(data.error || 'TTS failed');
        }
    } catch (error) {
        console.error('Text-to-speech error:', error);
        showToast('Failed to generate speech', 'error', 'TTS Error');
        return null;
    }
};

/**
 * Play pronunciation of a word
 */
const playWord = async (word) => {
    await textToSpeech(word, 'nova', 0.9);
};

// ============================================
// Event Listeners Setup
// ============================================

/**
 * Setup voice module event listeners
 */
const setupVoiceEventListeners = () => {
    const recordBtn = VoiceDOM.recordBtn || document.getElementById('voice-record-btn');
    const stopBtn = VoiceDOM.stopBtn || document.getElementById('voice-stop-btn');
    const playBtn = VoiceDOM.playBtn || document.getElementById('voice-play-btn');
    
    if (recordBtn) {
        recordBtn.addEventListener('click', startRecording);
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopRecording);
    }
    
    if (playBtn) {
        playBtn.addEventListener('click', playRecording);
    }
};

// ============================================
// Cleanup
// ============================================

/**
 * Cleanup voice resources
 */
const cleanup = () => {
    if (VoiceState.isRecording) {
        stopRecording();
    }
    
    if (VoiceState.isPlaying) {
        stopPlayback();
    }
    
    if (recognition && isRecognizing) {
        stopSpeechRecognition();
    }
    
    if (VoiceState.volumeInterval) {
        clearInterval(VoiceState.volumeInterval);
    }
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize voice module
 */
const initVoice = async () => {
    console.log('Initializing voice module...');
    
    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        VoiceState.isSupported = false;
        console.warn('Audio recording not supported in this browser');
        return;
    }
    
    // Get available devices
    await getAudioDevices();
    
    // Initialize waveform canvas
    initWaveform();
    
    // Setup event listeners
    setupVoiceEventListeners();
    
    // Initialize speech recognition
    initSpeechRecognition();
    
    console.log('Voice module initialized');
};

// ============================================
// Export Voice Module
// ============================================

const voice = {
    // State
    get isRecording() { return VoiceState.isRecording; },
    get isSupported() { return VoiceState.isSupported; },
    get recordingDuration() { return VoiceState.recordingDuration; },
    get currentAudio() { return VoiceState.currentAudio; },
    
    // Recording
    startRecording,
    stopRecording,
    playRecording,
    stopPlayback,
    
    // Analysis
    analyzePronunciation,
    displayPronunciationResults,
    
    // Speech Recognition
    startSpeechRecognition,
    stopSpeechRecognition,
    
    // Text-to-Speech
    textToSpeech,
    playWord,
    
    // Utilities
    blobToBase64,
    getAudioDuration,
    
    // Device
    getAudioDevices,
    checkMicrophonePermission,
    
    // Cleanup
    cleanup,
    
    // Initialize
    init: initVoice
};

// Make voice globally available
window.voice = voice;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = voice;
}
