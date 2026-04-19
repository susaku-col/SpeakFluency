/* ============================================
   SPEAKFLOW - VOICE RECOGNITION MODULE
   Version: 1.0.0
   Handles voice recording, speech recognition, and pronunciation analysis
   ============================================ */

// ============================================
// VOICE CONFIGURATION
// ============================================

const VoiceConfig = {
    // Speech Recognition Settings
    recognition: {
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1
    },
    
    // Recording Settings
    recording: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    },
    
    // Analysis Settings
    analysis: {
        pronunciationWeight: 0.4,
        fluencyWeight: 0.3,
        grammarWeight: 0.2,
        vocabularyWeight: 0.1,
        minConfidence: 0.6
    },
    
    // UI Settings
    ui: {
        recordingAnimation: true,
        showWaveform: true,
        showConfidence: true,
        autoStopDelay: 2000
    },
    
    // API Endpoints
    api: {
        analyze: '/api/voice/analyze',
        transcribe: '/api/voice/transcribe',
        feedback: '/api/voice/feedback'
    }
};

// ============================================
// VOICE STATE MANAGEMENT
// ============================================

class VoiceState {
    constructor() {
        this.state = {
            isSupported: false,
            isRecording: false,
            isProcessing: false,
            hasPermission: false,
            currentScore: null,
            currentTranscript: '',
            currentFeedback: null,
            audioLevel: 0,
            recordingDuration: 0,
            error: null,
            history: []
        };
        
        this.listeners = new Map();
        this.init();
    }
    
    init() {
        this.checkSupport();
        this.requestPermission();
    }
    
    checkSupport() {
        const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        this.setState('isSupported', isSupported);
        
        if (!isSupported) {
            this.setState('error', 'Speech recognition is not supported in this browser');
        }
        
        return isSupported;
    }
    
    async requestPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.setState('hasPermission', true);
            this.setState('error', null);
            
            // Stop all tracks after getting permission
            stream.getTracks().forEach(track => track.stop());
            
            return true;
        } catch (error) {
            this.setState('hasPermission', false);
            this.setState('error', 'Microphone permission denied');
            console.error('Permission error:', error);
            return false;
        }
    }
    
    setState(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        this.trigger('stateChange', { key, oldValue, newValue: value });
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
    }
    
    trigger(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }
    
    addToHistory(session) {
        this.state.history.unshift({
            ...session,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 sessions
        if (this.state.history.length > 100) {
            this.state.history.pop();
        }
        
        this.trigger('historyUpdated', this.state.history);
    }
    
    getHistory() {
        return this.state.history;
    }
}

// ============================================
// SPEECH RECOGNITION SERVICE
// ============================================

class SpeechRecognitionService {
    constructor(voiceState) {
        this.state = voiceState;
        this.recognition = null;
        this.initRecognition();
    }
    
    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error('Speech recognition not supported');
            return;
        }
        
        this.recognition = new SpeechRecognition();
        this.setupRecognition();
    }
    
    setupRecognition() {
        if (!this.recognition) return;
        
        this.recognition.lang = VoiceConfig.recognition.lang;
        this.recognition.interimResults = VoiceConfig.recognition.interimResults;
        this.recognition.continuous = VoiceConfig.recognition.continuous;
        this.recognition.maxAlternatives = VoiceConfig.recognition.maxAlternatives;
        
        this.recognition.onstart = () => this.handleStart();
        this.recognition.onend = () => this.handleEnd();
        this.recognition.onresult = (event) => this.handleResult(event);
        this.recognition.onerror = (event) => this.handleError(event);
        this.recognition.onnomatch = () => this.handleNoMatch();
    }
    
    start() {
        if (!this.recognition) {
            this.state.setState('error', 'Speech recognition not supported');
            return false;
        }
        
        if (!this.state.state.hasPermission) {
            this.state.requestPermission().then(permitted => {
                if (permitted) this.start();
            });
            return false;
        }
        
        try {
            this.recognition.start();
            this.state.setState('isRecording', true);
            this.state.setState('error', null);
            this.state.trigger('recordingStarted');
            return true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.state.setState('error', 'Failed to start recording');
            return false;
        }
    }
    
    stop() {
        if (!this.recognition) return false;
        
        try {
            this.recognition.stop();
            return true;
        } catch (error) {
            console.error('Failed to stop recognition:', error);
            return false;
        }
    }
    
    handleStart() {
        console.log('Speech recognition started');
        this.state.trigger('speechStart');
    }
    
    handleEnd() {
        console.log('Speech recognition ended');
        this.state.setState('isRecording', false);
        this.state.trigger('speechEnd');
    }
    
    handleResult(event) {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const confidence = event.results[i][0].confidence;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
                this.state.trigger('finalTranscript', { transcript, confidence });
            } else {
                interimTranscript += transcript;
                this.state.trigger('interimTranscript', { transcript, confidence });
            }
        }
        
        if (finalTranscript) {
            this.state.setState('currentTranscript', finalTranscript);
            this.state.trigger('transcriptComplete', finalTranscript);
        }
    }
    
    handleError(event) {
        console.error('Recognition error:', event.error);
        
        let errorMessage = 'Recognition error';
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage = 'No microphone found. Please check your microphone.';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied. Please allow access.';
                break;
            case 'network':
                errorMessage = 'Network error. Please check your connection.';
                break;
            default:
                errorMessage = `Error: ${event.error}`;
        }
        
        this.state.setState('error', errorMessage);
        this.state.trigger('recognitionError', { error: event.error, message: errorMessage });
    }
    
    handleNoMatch() {
        this.state.setState('error', 'Could not recognize speech. Please try again.');
        this.state.trigger('noMatch');
    }
    
    isSupported() {
        return !!this.recognition;
    }
}

// ============================================
// AUDIO RECORDER SERVICE
// ============================================

class AudioRecorderService {
    constructor(voiceState) {
        this.state = voiceState;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.sourceNode = null;
        this.analyserNode = null;
        this.stream = null;
    }
    
    async startRecording() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: VoiceConfig.recording
            });
            
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => this.handleStop();
            this.mediaRecorder.start(100); // Collect data every 100ms
            
            // Setup audio level monitoring
            this.setupAudioLevelMonitoring();
            
            this.state.setState('isRecording', true);
            this.state.trigger('recordingStarted');
            
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.state.setState('error', 'Failed to start audio recording');
            return false;
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.stopAudioLevelMonitoring();
            
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            return true;
        }
        return false;
    }
    
    handleStop() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.state.trigger('audioReady', audioBlob);
        this.state.setState('isRecording', false);
    }
    
    setupAudioLevelMonitoring() {
        if (!this.stream) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
        this.analyserNode = this.audioContext.createAnalyser();
        
        this.analyserNode.fftSize = 256;
        this.sourceNode.connect(this.analyserNode);
        
        const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
        
        const updateLevel = () => {
            if (!this.state.state.isRecording) return;
            
            this.analyserNode.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const level = average / 255;
            
            this.state.setState('audioLevel', level);
            this.state.trigger('audioLevelUpdate', level);
            
            requestAnimationFrame(updateLevel);
        };
        
        updateLevel();
    }
    
    stopAudioLevelMonitoring() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.sourceNode = null;
        this.analyserNode = null;
    }
    
    async getAudioBlob() {
        return new Blob(this.audioChunks, { type: 'audio/webm' });
    }
}

// ============================================
// PRONUNCIATION ANALYZER
// ============================================

class PronunciationAnalyzer {
    constructor(voiceState) {
        this.state = voiceState;
    }
    
    async analyze(transcript, expectedText = null) {
        this.state.setState('isProcessing', true);
        this.state.trigger('analysisStarted');
        
        try {
            // Analyze with AI API
            const analysis = await this.callAnalysisAPI(transcript, expectedText);
            
            // Calculate scores
            const scores = this.calculateScores(analysis);
            const feedback = this.generateFeedback(scores, analysis);
            
            const result = {
                transcript,
                expectedText,
                scores,
                feedback,
                details: analysis,
                timestamp: new Date().toISOString()
            };
            
            this.state.setState('currentScore', scores.total);
            this.state.setState('currentFeedback', feedback);
            this.state.trigger('analysisComplete', result);
            
            // Add to history
            this.state.addToHistory(result);
            
            return result;
        } catch (error) {
            console.error('Analysis failed:', error);
            this.state.setState('error', 'Failed to analyze pronunciation');
            this.state.trigger('analysisError', error);
            return null;
        } finally {
            this.state.setState('isProcessing', false);
        }
    }
    
    async callAnalysisAPI(transcript, expectedText) {
        // For demo, simulate API call
        // In production, replace with actual API call
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const analysis = this.simulateAnalysis(transcript, expectedText);
                resolve(analysis);
            }, 1000);
        });
        
        // Actual API call:
        /*
        const response = await fetch(VoiceConfig.api.analyze, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript, expectedText })
        });
        return await response.json();
        */
    }
    
    simulateAnalysis(transcript, expectedText) {
        const words = transcript.toLowerCase().split(' ');
        const expectedWords = expectedText ? expectedText.toLowerCase().split(' ') : words;
        
        // Simulate pronunciation quality
        const pronunciationScore = Math.min(1, Math.max(0.5, 
            0.7 + (Math.random() - 0.5) * 0.3
        ));
        
        // Simulate fluency (based on words per second)
        const fluencyScore = Math.min(1, Math.max(0.4, 
            0.6 + (Math.random() - 0.5) * 0.4
        ));
        
        // Simulate grammar check
        const grammarScore = Math.min(1, Math.max(0.5, 
            0.7 + (Math.random() - 0.5) * 0.3
        ));
        
        // Simulate vocabulary score
        const vocabularyScore = Math.min(1, Math.max(0.4, 
            0.6 + (Math.random() - 0.5) * 0.4
        ));
        
        // Find mispronounced words
        const mispronouncedWords = this.findMispronouncedWords(transcript);
        
        return {
            pronunciation: pronunciationScore,
            fluency: fluencyScore,
            grammar: grammarScore,
            vocabulary: vocabularyScore,
            mispronouncedWords,
            suggestions: this.generateSuggestions(mispronouncedWords),
            confidence: 0.75 + Math.random() * 0.2
        };
    }
    
    findMispronouncedWords(transcript) {
        const commonMistakes = [
            { pattern: /\bgonna\b/i, correction: 'going to' },
            { pattern: /\bwanna\b/i, correction: 'want to' },
            { pattern: /\bgotta\b/i, correction: 'got to' },
            { pattern: /\bkind of\b/i, correction: 'kind of (pronounce clearly)' },
            { pattern: /\bout of\b/i, correction: 'out of (connect sounds)' }
        ];
        
        const mistakes = [];
        for (const mistake of commonMistakes) {
            if (mistake.pattern.test(transcript)) {
                mistakes.push({
                    original: transcript.match(mistake.pattern)[0],
                    correction: mistake.correction,
                    position: transcript.search(mistake.pattern)
                });
            }
        }
        
        return mistakes;
    }
    
    generateSuggestions(mispronouncedWords) {
        if (mispronouncedWords.length === 0) {
            return ['Great pronunciation! Keep practicing to improve fluency.'];
        }
        
        return mispronouncedWords.map(m => 
            `Try saying "${m.correction}" instead of "${m.original}"`
        );
    }
    
    calculateScores(analysis) {
        const weights = VoiceConfig.analysis;
        
        const pronunciation = analysis.pronunciation * 100;
        const fluency = analysis.fluency * 100;
        const grammar = analysis.grammar * 100;
        const vocabulary = analysis.vocabulary * 100;
        
        const total = 
            pronunciation * weights.pronunciationWeight +
            fluency * weights.fluencyWeight +
            grammar * weights.grammarWeight +
            vocabulary * weights.vocabularyWeight;
        
        return {
            pronunciation: Math.round(pronunciation),
            fluency: Math.round(fluency),
            grammar: Math.round(grammar),
            vocabulary: Math.round(vocabulary),
            total: Math.round(total)
        };
    }
    
    generateFeedback(scores, analysis) {
        const feedback = {
            summary: '',
            strengths: [],
            improvements: [],
            tips: []
        };
        
        // Summary based on total score
        if (scores.total >= 85) {
            feedback.summary = 'Excellent! Your pronunciation is very clear and natural.';
        } else if (scores.total >= 70) {
            feedback.summary = 'Good job! A few areas need improvement.';
        } else if (scores.total >= 50) {
            feedback.summary = 'Keep practicing! Focus on the suggestions below.';
        } else {
            feedback.summary = 'Let\'s work on the basics. Try speaking more slowly and clearly.';
        }
        
        // Strengths
        if (scores.pronunciation >= 80) {
            feedback.strengths.push('Clear pronunciation');
        }
        if (scores.fluency >= 75) {
            feedback.strengths.push('Good speaking pace');
        }
        if (scores.grammar >= 80) {
            feedback.strengths.push('Proper sentence structure');
        }
        if (scores.vocabulary >= 75) {
            feedback.strengths.push('Rich vocabulary usage');
        }
        
        // Areas for improvement
        if (scores.pronunciation < 70) {
            feedback.improvements.push('Work on word stress and intonation');
        }
        if (scores.fluency < 65) {
            feedback.improvements.push('Try to reduce pauses and speak more smoothly');
        }
        if (scores.grammar < 70) {
            feedback.improvements.push('Review basic grammar rules');
        }
        if (scores.vocabulary < 65) {
            feedback.improvements.push('Learn more common expressions');
        }
        
        // Add specific tips from analysis
        feedback.tips = analysis.suggestions.slice(0, 3);
        
        return feedback;
    }
}

// ============================================
// VOICE UI CONTROLLER
// ============================================

class VoiceUIController {
    constructor(voiceState, recognitionService, recorderService, analyzer) {
        this.state = voiceState;
        this.recognition = recognitionService;
        this.recorder = recorderService;
        this.analyzer = analyzer;
        
        this.elements = {};
        this.waveformCanvas = null;
        this.waveformContext = null;
        
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.setupStateListeners();
        this.setupWaveform();
    }
    
    bindElements() {
        this.elements = {
            micBtn: document.getElementById('micBtn'),
            micIcon: document.getElementById('micIcon'),
            recordStatus: document.getElementById('recordStatus'),
            transcriptDisplay: document.getElementById('transcriptDisplay'),
            scoreDisplay: document.getElementById('scoreDisplay'),
            feedbackDisplay: document.getElementById('feedbackDisplay'),
            audioLevelBar: document.getElementById('audioLevelBar'),
            recordingTimer: document.getElementById('recordingTimer'),
            errorMessage: document.getElementById('voiceErrorMessage')
        };
    }
    
    bindEvents() {
        if (this.elements.micBtn) {
            this.elements.micBtn.addEventListener('click', () => this.toggleRecording());
        }
    }
    
    setupStateListeners() {
        this.state.on('stateChange', (data) => {
            this.updateUI(data.key, data.newValue);
        });
        
        this.state.on('recordingStarted', () => {
            this.onRecordingStarted();
        });
        
        this.state.on('recordingEnded', () => {
            this.onRecordingEnded();
        });
        
        this.state.on('transcriptComplete', (transcript) => {
            this.onTranscriptComplete(transcript);
        });
        
        this.state.on('analysisComplete', (result) => {
            this.onAnalysisComplete(result);
        });
        
        this.state.on('audioLevelUpdate', (level) => {
            this.updateAudioLevel(level);
        });
    }
    
    setupWaveform() {
        const canvas = document.getElementById('waveformCanvas');
        if (canvas && VoiceConfig.ui.showWaveform) {
            this.waveformCanvas = canvas;
            this.waveformContext = canvas.getContext('2d');
            this.drawWaveform();
        }
    }
    
    toggleRecording() {
        if (this.state.state.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }
    
    async startRecording() {
        if (!this.state.state.hasPermission) {
            const permitted = await this.state.requestPermission();
            if (!permitted) return;
        }
        
        // Use either recognition or recording based on preference
        if (this.recognition.isSupported()) {
            this.recognition.start();
        } else {
            this.recorder.startRecording();
        }
        
        this.startTimer();
        this.startWaveformAnimation();
    }
    
    stopRecording() {
        if (this.recognition.isSupported()) {
            this.recognition.stop();
        } else {
            this.recorder.stopRecording();
        }
        
        this.stopTimer();
        this.stopWaveformAnimation();
    }
    
    onRecordingStarted() {
        if (this.elements.micBtn) {
            this.elements.micBtn.classList.add('recording');
            this.elements.micIcon.textContent = '⏹️';
        }
        
        if (this.elements.recordStatus) {
            this.elements.recordStatus.textContent = 'Recording... Speak now';
            this.elements.recordStatus.style.color = 'var(--color-danger)';
        }
        
        // Clear previous results
        if (this.elements.transcriptDisplay) {
            this.elements.transcriptDisplay.innerHTML = '';
        }
        if (this.elements.scoreDisplay) {
            this.elements.scoreDisplay.innerHTML = '';
        }
    }
    
    onRecordingEnded() {
        if (this.elements.micBtn) {
            this.elements.micBtn.classList.remove('recording');
            this.elements.micIcon.textContent = '🎤';
        }
        
        if (this.elements.recordStatus) {
            this.elements.recordStatus.textContent = 'Processing...';
            this.elements.recordStatus.style.color = 'var(--color-warning)';
        }
    }
    
    onTranscriptComplete(transcript) {
        if (this.elements.transcriptDisplay) {
            this.elements.transcriptDisplay.innerHTML = `
                <div class="chat-bubble user">${this.escapeHtml(transcript)}</div>
            `;
        }
        
        // Auto-analyze after recording
        this.analyzer.analyze(transcript);
    }
    
    onAnalysisComplete(result) {
        // Display score
        if (this.elements.scoreDisplay) {
            const scoreColor = this.getScoreColor(result.scores.total);
            this.elements.scoreDisplay.innerHTML = `
                <div class="score-container" style="text-align: center; margin: 16px 0;">
                    <div class="score-circle" style="
                        width: 100px;
                        height: 100px;
                        border-radius: 50%;
                        background: conic-gradient(${scoreColor} 0deg ${result.scores.total * 3.6}deg, #e2e8f0 ${result.scores.total * 3.6}deg);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto;
                    ">
                        <div style="background: var(--bg-primary); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                            <span style="font-size: 28px; font-weight: bold;">${result.scores.total}</span>
                            <span style="font-size: 12px;">Score</span>
                        </div>
                    </div>
                    <div class="scores-detail" style="display: flex; justify-content: center; gap: 16px; margin-top: 16px;">
                        <div>🎯 Pronunciation: ${result.scores.pronunciation}</div>
                        <div>⚡ Fluency: ${result.scores.fluency}</div>
                        <div>📝 Grammar: ${result.scores.grammar}</div>
                        <div>📚 Vocabulary: ${result.scores.vocabulary}</div>
                    </div>
                </div>
            `;
        }
        
        // Display feedback
        if (this.elements.feedbackDisplay) {
            this.elements.feedbackDisplay.innerHTML = `
                <div class="feedback-container" style="margin-top: 16px;">
                    <div class="feedback-summary" style="font-weight: bold; margin-bottom: 12px;">
                        ${result.feedback.summary}
                    </div>
                    ${result.feedback.strengths.length > 0 ? `
                        <div class="feedback-strengths" style="margin-bottom: 12px;">
                            <strong>✅ Strengths:</strong>
                            <ul>${result.feedback.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
                        </div>
                    ` : ''}
                    ${result.feedback.improvements.length > 0 ? `
                        <div class="feedback-improvements" style="margin-bottom: 12px;">
                            <strong>📈 Areas to Improve:</strong>
                            <ul>${result.feedback.improvements.map(i => `<li>${i}</li>`).join('')}</ul>
                        </div>
                    ` : ''}
                    ${result.feedback.tips.length > 0 ? `
                        <div class="feedback-tips">
                            <strong>💡 Tips:</strong>
                            <ul>${result.feedback.tips.map(t => `<li>${t}</li>`).join('')}</ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        if (this.elements.recordStatus) {
            this.elements.recordStatus.textContent = 'Ready';
            this.elements.recordStatus.style.color = 'var(--text-secondary)';
        }
        
        // Trigger XP gain event
        const xpGain = Math.floor(result.scores.total / 10);
        const event = new CustomEvent('voice:practiceComplete', {
            detail: { score: result.scores.total, xp: xpGain }
        });
        document.dispatchEvent(event);
    }
    
    updateUI(key, value) {
        switch(key) {
            case 'error':
                this.showError(value);
                break;
            case 'audioLevel':
                this.updateAudioLevel(value);
                break;
        }
    }
    
    updateAudioLevel(level) {
        if (this.elements.audioLevelBar) {
            const percentage = level * 100;
            this.elements.audioLevelBar.style.width = `${percentage}%`;
            this.elements.audioLevelBar.style.backgroundColor = 
                level > 0.7 ? 'var(--color-success)' :
                level > 0.3 ? 'var(--color-primary)' :
                'var(--color-warning)';
        }
    }
    
    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.style.display = 'block';
            setTimeout(() => {
                if (this.elements.errorMessage) {
                    this.elements.errorMessage.style.display = 'none';
                }
            }, 5000);
        }
    }
    
    getScoreColor(score) {
        if (score >= 80) return 'var(--color-success)';
        if (score >= 60) return 'var(--color-primary)';
        if (score >= 40) return 'var(--color-warning)';
        return 'var(--color-danger)';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Timer functionality
    startTimer() {
        let seconds = 0;
        this.timerInterval = setInterval(() => {
            seconds++;
            if (this.elements.recordingTimer) {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                this.elements.recordingTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.elements.recordingTimer) {
            this.elements.recordingTimer.textContent = '0:00';
        }
    }
    
    // Waveform animation
    startWaveformAnimation() {
        if (!this.waveformCanvas) return;
        this.waveformAnimation = requestAnimationFrame(() => this.drawWaveform());
    }
    
    stopWaveformAnimation() {
        if (this.waveformAnimation) {
            cancelAnimationFrame(this.waveformAnimation);
            this.waveformAnimation = null;
        }
        this.clearWaveform();
    }
    
    drawWaveform() {
        if (!this.waveformContext || !this.state.state.isRecording) return;
        
        const canvas = this.waveformCanvas;
        const ctx = this.waveformContext;
        const width = canvas.width;
        const height = canvas.height;
        const level = this.state.state.audioLevel;
        
        ctx.clearRect(0, 0, width, height);
        
        const barWidth = 4;
        const barCount = Math.floor(width / (barWidth + 2));
        const barHeight = level * height;
        
        for (let i = 0; i < barCount; i++) {
            const x = i * (barWidth + 2);
            const y = (height - barHeight) / 2;
            const h = barHeight + (Math.sin(Date.now() * 0.005 + i) * 5);
            
            ctx.fillStyle = `hsl(${200 + level * 60}, 70%, 50%)`;
            ctx.fillRect(x, y, barWidth, Math.max(2, h));
        }
        
        this.waveformAnimation = requestAnimationFrame(() => this.drawWaveform());
    }
    
    clearWaveform() {
        if (this.waveformContext && this.waveformCanvas) {
            this.waveformContext.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
        }
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize voice system
const voiceState = new VoiceState();
const recognitionService = new SpeechRecognitionService(voiceState);
const recorderService = new AudioRecorderService(voiceState);
const pronunciationAnalyzer = new PronunciationAnalyzer(voiceState);
const voiceUI = new VoiceUIController(voiceState, recognitionService, recorderService, pronunciationAnalyzer);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.Voice = {
    state: voiceState,
    recognition: recognitionService,
    recorder: recorderService,
    analyzer: pronunciationAnalyzer,
    ui: voiceUI
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VoiceConfig,
        VoiceState,
        SpeechRecognitionService,
        AudioRecorderService,
        PronunciationAnalyzer,
        VoiceUIController
    };
}

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Voice module initialized');
    
    // Check if we're on a page with voice features
    const hasVoiceFeature = document.querySelector('[data-voice-enabled]');
    if (hasVoiceFeature) {
        voiceState.requestPermission();
    }
});
