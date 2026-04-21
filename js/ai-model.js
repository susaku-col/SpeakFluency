// ============================================
// SpeakFlow AI Model Module
// AI-Powered Language Learning Features
// ============================================

// ============================================
// AI State Management
// ============================================

const AIState = {
    isInitialized: false,
    isProcessing: false,
    currentModel: 'gpt-3.5-turbo',
    availableModels: ['gpt-3.5-turbo', 'gpt-4-turbo-preview'],
    settings: {
        temperature: 0.7,
        maxTokens: 150,
        language: 'en',
        level: 'intermediate'
    },
    cache: new Map(),
    conversationHistory: [],
    sessionId: null
};

// ============================================
// DOM Elements
// ============================================

const AIDOM = {
    chatContainer: document.getElementById('ai-chat-container'),
    chatInput: document.getElementById('ai-chat-input'),
    chatSendBtn: document.getElementById('ai-chat-send'),
    modelSelect: document.getElementById('ai-model-select'),
    temperatureSlider: document.getElementById('ai-temperature'),
    languageSelect: document.getElementById('ai-language'),
    levelSelect: document.getElementById('ai-level'),
    loadingIndicator: document.getElementById('ai-loading'),
    suggestionsContainer: document.getElementById('ai-suggestions')
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique session ID
 */
const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Show AI loading state
 */
const showAILoading = () => {
    AIState.isProcessing = true;
    if (AIDOM.loadingIndicator) {
        AIDOM.loadingIndicator.classList.add('active');
    }
};

/**
 * Hide AI loading state
 */
const hideAILoading = () => {
    AIState.isProcessing = false;
    if (AIDOM.loadingIndicator) {
        AIDOM.loadingIndicator.classList.remove('active');
    }
};

/**
 * Add message to chat
 */
const addChatMessage = (message, isUser = false) => {
    const chatContainer = AIDOM.chatContainer;
    if (!chatContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${isUser ? '👤' : '🤖'}</div>
        <div class="message-content">
            <div class="message-text">${escapeHtml(message)}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        </div>
    `;
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

/**
 * Escape HTML to prevent XSS
 */
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

/**
 * Show typing indicator
 */
const showTypingIndicator = () => {
    const chatContainer = AIDOM.chatContainer;
    if (!chatContainer) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message ai-message typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    
    chatContainer.appendChild(typingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

/**
 * Hide typing indicator
 */
const hideTypingIndicator = () => {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
};

// ============================================
// AI Chat Functions
// ============================================

/**
 * Initialize AI chat session
 */
const initAIChat = async () => {
    AIState.sessionId = generateSessionId();
    AIState.conversationHistory = [];
    
    // Load conversation history from localStorage
    const savedHistory = localStorage.getItem('ai_chat_history');
    if (savedHistory) {
        try {
            AIState.conversationHistory = JSON.parse(savedHistory);
            // Display last 10 messages
            const lastMessages = AIState.conversationHistory.slice(-10);
            for (const msg of lastMessages) {
                addChatMessage(msg.content, msg.role === 'user');
            }
        } catch (e) {
            console.error('Error loading chat history:', e);
        }
    }
    
    // Add welcome message if no history
    if (AIState.conversationHistory.length === 0) {
        const welcomeMessage = `Hello! I'm your AI language learning assistant. I can help you practice English conversation, explain grammar, teach vocabulary, and more. What would you like to practice today?`;
        addChatMessage(welcomeMessage, false);
        AIState.conversationHistory.push({
            role: 'assistant',
            content: welcomeMessage,
            timestamp: new Date().toISOString()
        });
        saveChatHistory();
    }
};

/**
 * Send message to AI
 */
const sendAIMessage = async (message) => {
    if (!message.trim()) return;
    
    // Add user message to chat
    addChatMessage(message, true);
    AIState.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
    });
    saveChatHistory();
    
    // Clear input
    if (AIDOM.chatInput) {
        AIDOM.chatInput.value = '';
    }
    
    // Show typing indicator
    showTypingIndicator();
    showAILoading();
    
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                message: message,
                sessionId: AIState.sessionId,
                history: AIState.conversationHistory.slice(-20),
                settings: AIState.settings
            })
        });
        
        const data = await response.json();
        
        hideTypingIndicator();
        
        if (data.success) {
            addChatMessage(data.response, false);
            AIState.conversationHistory.push({
                role: 'assistant',
                content: data.response,
                timestamp: new Date().toISOString(),
                suggestions: data.suggestions
            });
            saveChatHistory();
            
            // Show follow-up suggestions if available
            if (data.suggestions && data.suggestions.length > 0) {
                showFollowUpSuggestions(data.suggestions);
            }
        } else {
            addChatMessage('Sorry, I encountered an error. Please try again.', false);
        }
    } catch (error) {
        console.error('AI chat error:', error);
        hideTypingIndicator();
        addChatMessage('Network error. Please check your connection and try again.', false);
    } finally {
        hideAILoading();
    }
};

/**
 * Save chat history to localStorage
 */
const saveChatHistory = () => {
    // Keep only last 100 messages
    const historyToSave = AIState.conversationHistory.slice(-100);
    localStorage.setItem('ai_chat_history', JSON.stringify(historyToSave));
};

/**
 * Clear chat history
 */
const clearChatHistory = () => {
    if (confirm('Are you sure you want to clear chat history?')) {
        AIState.conversationHistory = [];
        if (AIDOM.chatContainer) {
            AIDOM.chatContainer.innerHTML = '';
        }
        localStorage.removeItem('ai_chat_history');
        initAIChat(); // Re-initialize with welcome message
        showToast('Chat history cleared', 'info');
    }
};

/**
 * Show follow-up suggestions
 */
const showFollowUpSuggestions = (suggestions) => {
    const suggestionsContainer = AIDOM.suggestionsContainer;
    if (!suggestionsContainer) return;
    
    suggestionsContainer.innerHTML = `
        <div class="suggestions-title">Suggested responses:</div>
        <div class="suggestions-buttons">
            ${suggestions.map(s => `
                <button class="suggestion-btn" onclick="ai.sendMessage('${escapeHtml(s).replace(/'/g, "\\'")}')">
                    ${escapeHtml(s)}
                </button>
            `).join('')}
        </div>
    `;
};

// ============================================
// Grammar Check Functions
// ============================================

/**
 * Check grammar of text
 */
const checkGrammar = async (text) => {
    showAILoading();
    
    try {
        const response = await fetch('/api/ai/grammar-check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                text: text,
                level: AIState.settings.level
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayGrammarResults(data);
            return data;
        } else {
            showToast(data.error || 'Grammar check failed', 'error');
            return null;
        }
    } catch (error) {
        console.error('Grammar check error:', error);
        showToast('Failed to check grammar', 'error');
        return null;
    } finally {
        hideAILoading();
    }
};

/**
 * Display grammar check results
 */
const displayGrammarResults = (results) => {
    const container = document.getElementById('grammar-results');
    if (!container) return;
    
    const { hasErrors, errors, score, suggestions, originalText } = results;
    
    container.innerHTML = `
        <div class="grammar-score">
            <div class="score-circle" data-score="${score}">
                <span class="score-value">${score}</span>
                <span class="score-label">Grammar Score</span>
            </div>
        </div>
        
        ${hasErrors ? `
            <div class="grammar-errors">
                <h4>Errors Found (${errors.length})</h4>
                <div class="error-list">
                    ${errors.map(error => `
                        <div class="error-item">
                            <div class="error-original">❌ ${escapeHtml(error.original)}</div>
                            <div class="error-correction">✓ ${escapeHtml(error.correction)}</div>
                            <div class="error-explanation">${escapeHtml(error.explanation)}</div>
                            <div class="error-type">${error.type}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : `
            <div class="no-errors">
                <span class="success-icon">✅</span>
                <p>No grammar errors found! Great job!</p>
            </div>
        `}
        
        ${suggestions && suggestions.length > 0 ? `
            <div class="grammar-suggestions">
                <h4>Suggestions for Improvement</h4>
                <ul>
                    ${suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    `;
};

// ============================================
// Vocabulary Functions
// ============================================

/**
 * Get word definition and examples
 */
const getWordDefinition = async (word) => {
    // Check cache first
    if (AIState.cache.has(word)) {
        return AIState.cache.get(word);
    }
    
    showAILoading();
    
    try {
        const response = await fetch('/api/ai/vocabulary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                word: word,
                level: AIState.settings.level
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Cache result
            AIState.cache.set(word, data);
            return data;
        } else {
            showToast(data.error || 'Word not found', 'error');
            return null;
        }
    } catch (error) {
        console.error('Vocabulary lookup error:', error);
        showToast('Failed to look up word', 'error');
        return null;
    } finally {
        hideAILoading();
    }
};

/**
 * Display word definition
 */
const displayWordDefinition = (data) => {
    const container = document.getElementById('word-definition');
    if (!container) return;
    
    const { word, pronunciation, partOfSpeech, definitions, synonyms, antonyms, examples, tips } = data;
    
    container.innerHTML = `
        <div class="word-header">
            <h2>${escapeHtml(word)}</h2>
            ${pronunciation ? `<span class="word-pronunciation">/${pronunciation}/</span>` : ''}
            <span class="word-part">${partOfSpeech}</span>
        </div>
        
        <div class="word-definitions">
            <h4>Definitions</h4>
            ${definitions.map(def => `
                <div class="definition-item">
                    <div class="definition-meaning">${escapeHtml(def.meaning)}</div>
                    ${def.example ? `<div class="definition-example">"${escapeHtml(def.example)}"</div>` : ''}
                </div>
            `).join('')}
        </div>
        
        ${synonyms && synonyms.length > 0 ? `
            <div class="word-synonyms">
                <h4>Synonyms</h4>
                <div class="word-tags">
                    ${synonyms.map(s => `<span class="word-tag">${escapeHtml(s)}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        
        ${antonyms && antonyms.length > 0 ? `
            <div class="word-antonyms">
                <h4>Antonyms</h4>
                <div class="word-tags">
                    ${antonyms.map(a => `<span class="word-tag">${escapeHtml(a)}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        
        ${examples && examples.length > 0 ? `
            <div class="word-examples">
                <h4>Example Sentences</h4>
                <ul>
                    ${examples.map(e => `<li>"${escapeHtml(e)}"</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        ${tips ? `
            <div class="word-tips">
                <h4>💡 Memory Tip</h4>
                <p>${escapeHtml(tips)}</p>
            </div>
        ` : ''}
        
        <div class="word-actions">
            <button class="btn btn-outline btn-sm" onclick="voice.textToSpeech('${escapeHtml(word)}')">🔊 Listen</button>
            <button class="btn btn-outline btn-sm" onclick="vocabulary.addToStudyList('${escapeHtml(word)}')">📚 Add to Study List</button>
        </div>
    `;
};

// ============================================
// Text Simplification
// ============================================

/**
 * Simplify text for language learners
 */
const simplifyText = async (text) => {
    showAILoading();
    
    try {
        const response = await fetch('/api/ai/simplify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                text: text,
                targetLevel: AIState.settings.level
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displaySimplifiedText(data);
            return data;
        } else {
            showToast(data.error || 'Text simplification failed', 'error');
            return null;
        }
    } catch (error) {
        console.error('Text simplification error:', error);
        showToast('Failed to simplify text', 'error');
        return null;
    } finally {
        hideAILoading();
    }
};

/**
 * Display simplified text
 */
const displaySimplifiedText = (data) => {
    const container = document.getElementById('simplified-text');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-comparison">
            <div class="original-text">
                <h4>Original Text</h4>
                <div class="text-content">${escapeHtml(data.original)}</div>
            </div>
            <div class="simplified-text">
                <h4>Simplified (${data.targetLevel} level)</h4>
                <div class="text-content">${escapeHtml(data.simplified)}</div>
            </div>
        </div>
        <div class="text-actions">
            <button class="btn btn-outline btn-sm" onclick="voice.textToSpeech('${escapeHtml(data.simplified)}')">🔊 Listen</button>
            <button class="btn btn-outline btn-sm" onclick="copyToClipboard('${escapeHtml(data.simplified)}')">📋 Copy</button>
        </div>
    `;
};

// ============================================
// Quiz Generation
// ============================================

/**
 * Generate quiz questions
 */
const generateQuiz = async (topic, difficulty = 'intermediate', questionCount = 5) => {
    showAILoading();
    
    try {
        const response = await fetch('/api/ai/quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                topic: topic,
                difficulty: difficulty,
                questionCount: questionCount,
                level: AIState.settings.level
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayQuiz(data);
            return data;
        } else {
            showToast(data.error || 'Quiz generation failed', 'error');
            return null;
        }
    } catch (error) {
        console.error('Quiz generation error:', error);
        showToast('Failed to generate quiz', 'error');
        return null;
    } finally {
        hideAILoading();
    }
};

/**
 * Display quiz
 */
const displayQuiz = (data) => {
    const container = document.getElementById('quiz-container');
    if (!container) return;
    
    let quizHtml = `
        <div class="quiz-header">
            <h3>Quiz: ${escapeHtml(data.topic)}</h3>
            <p>Difficulty: ${data.difficulty} | ${data.totalQuestions} questions</p>
        </div>
        <form id="quiz-form" class="quiz-form">
    `;
    
    data.questions.forEach((q, index) => {
        quizHtml += `
            <div class="quiz-question">
                <p class="question-text">${index + 1}. ${escapeHtml(q.question)}</p>
                <div class="question-options">
                    ${q.options.map((opt, optIndex) => `
                        <label class="quiz-option">
                            <input type="radio" name="q${index}" value="${optIndex}">
                            <span>${escapeHtml(opt)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    quizHtml += `
            <button type="submit" class="btn btn-primary">Submit Quiz</button>
        </form>
        <div id="quiz-results" class="quiz-results"></div>
    `;
    
    container.innerHTML = quizHtml;
    
    // Add submit handler
    const quizForm = document.getElementById('quiz-form');
    if (quizForm) {
        quizForm.addEventListener('submit', (e) => {
            e.preventDefault();
            gradeQuiz(data.questions);
        });
    }
};

/**
 * Grade quiz
 */
const gradeQuiz = (questions) => {
    let score = 0;
    const results = [];
    
    questions.forEach((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        const isCorrect = selected && parseInt(selected.value) === q.correctAnswer;
        if (isCorrect) score++;
        
        results.push({
            question: q.question,
            correct: isCorrect,
            correctAnswer: q.options[q.correctAnswer],
            explanation: q.explanation
        });
    });
    
    const percentage = (score / questions.length) * 100;
    
    const resultsContainer = document.getElementById('quiz-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="quiz-score">
                <div class="score-circle" data-score="${percentage}">
                    <span class="score-value">${Math.round(percentage)}%</span>
                    <span class="score-label">Score</span>
                </div>
                <p>You got ${score} out of ${questions.length} correct!</p>
            </div>
            <div class="quiz-answers">
                <h4>Review Answers</h4>
                ${results.map((r, i) => `
                    <div class="answer-review ${r.correct ? 'correct' : 'incorrect'}">
                        <div class="question">${i + 1}. ${escapeHtml(r.question)}</div>
                        <div class="your-answer">Your answer: ${r.correct ? '✓ Correct' : '✗ Incorrect'}</div>
                        <div class="correct-answer">Correct answer: ${escapeHtml(r.correctAnswer)}</div>
                        <div class="explanation">${escapeHtml(r.explanation)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// ============================================
// Text Translation
// ============================================

/**
 * Translate text
 */
const translateText = async (text, targetLanguage) => {
    showAILoading();
    
    try {
        const response = await fetch('/api/ai/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                text: text,
                targetLanguage: targetLanguage,
                sourceLanguage: 'en'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayTranslation(data);
            return data;
        } else {
            showToast(data.error || 'Translation failed', 'error');
            return null;
        }
    } catch (error) {
        console.error('Translation error:', error);
        showToast('Failed to translate text', 'error');
        return null;
    } finally {
        hideAILoading();
    }
};

/**
 * Display translation
 */
const displayTranslation = (data) => {
    const container = document.getElementById('translation-result');
    if (!container) return;
    
    container.innerHTML = `
        <div class="translation-box">
            <div class="original">
                <div class="label">Original (English)</div>
                <div class="text">${escapeHtml(data.original)}</div>
            </div>
            <div class="translated">
                <div class="label">Translated (${data.targetLanguage})</div>
                <div class="text">${escapeHtml(data.translated)}</div>
            </div>
            <div class="translation-actions">
                <button class="btn btn-outline btn-sm" onclick="voice.textToSpeech('${escapeHtml(data.translated)}')">🔊 Listen</button>
                <button class="btn btn-outline btn-sm" onclick="copyToClipboard('${escapeHtml(data.translated)}')">📋 Copy</button>
            </div>
        </div>
    `;
};

// ============================================
// Settings Management
// ============================================

/**
 * Update AI settings
 */
const updateAISettings = () => {
    if (AIDOM.modelSelect) {
        AIState.currentModel = AIDOM.modelSelect.value;
    }
    
    if (AIDOM.temperatureSlider) {
        AIState.settings.temperature = parseFloat(AIDOM.temperatureSlider.value);
        const tempValue = document.getElementById('temperature-value');
        if (tempValue) {
            tempValue.textContent = AIState.settings.temperature;
        }
    }
    
    if (AIDOM.languageSelect) {
        AIState.settings.language = AIDOM.languageSelect.value;
    }
    
    if (AIDOM.levelSelect) {
        AIState.settings.level = AIDOM.levelSelect.value;
    }
    
    // Save settings to localStorage
    localStorage.setItem('ai_settings', JSON.stringify(AIState.settings));
};

/**
 * Load AI settings
 */
const loadAISettings = () => {
    const savedSettings = localStorage.getItem('ai_settings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            AIState.settings = { ...AIState.settings, ...settings };
        } catch (e) {
            console.error('Error loading AI settings:', e);
        }
    }
    
    // Apply settings to UI
    if (AIDOM.modelSelect) {
        AIDOM.modelSelect.value = AIState.currentModel;
    }
    
    if (AIDOM.temperatureSlider) {
        AIDOM.temperatureSlider.value = AIState.settings.temperature;
        const tempValue = document.getElementById('temperature-value');
        if (tempValue) {
            tempValue.textContent = AIState.settings.temperature;
        }
    }
    
    if (AIDOM.languageSelect) {
        AIDOM.languageSelect.value = AIState.settings.language;
    }
    
    if (AIDOM.levelSelect) {
        AIDOM.levelSelect.value = AIState.settings.level;
    }
};

// ============================================
// Event Listeners
// ============================================

/**
 * Setup AI event listeners
 */
const setupAIEventListeners = () => {
    // Chat send button
    if (AIDOM.chatSendBtn && AIDOM.chatInput) {
        AIDOM.chatSendBtn.addEventListener('click', () => {
            sendAIMessage(AIDOM.chatInput.value);
        });
        
        AIDOM.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAIMessage(AIDOM.chatInput.value);
            }
        });
    }
    
    // Settings change listeners
    if (AIDOM.modelSelect) {
        AIDOM.modelSelect.addEventListener('change', updateAISettings);
    }
    
    if (AIDOM.temperatureSlider) {
        AIDOM.temperatureSlider.addEventListener('input', () => {
            const value = parseFloat(AIDOM.temperatureSlider.value);
            const tempValue = document.getElementById('temperature-value');
            if (tempValue) {
                tempValue.textContent = value;
            }
            updateAISettings();
        });
    }
    
    if (AIDOM.languageSelect) {
        AIDOM.languageSelect.addEventListener('change', updateAISettings);
    }
    
    if (AIDOM.levelSelect) {
        AIDOM.levelSelect.addEventListener('change', updateAISettings);
    }
    
    // Clear chat button
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChatHistory);
    }
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize AI module
 */
const initAI = async () => {
    console.log('Initializing AI module...');
    
    // Load settings
    loadAISettings();
    
    // Initialize chat
    await initAIChat();
    
    // Setup event listeners
    setupAIEventListeners();
    
    AIState.isInitialized = true;
    
    console.log('AI module initialized');
};

// ============================================
// Export AI Module
// ============================================

const ai = {
    // State
    get isInitialized() { return AIState.isInitialized; },
    get isProcessing() { return AIState.isProcessing; },
    get settings() { return AIState.settings; },
    
    // Chat
    sendMessage: sendAIMessage,
    clearHistory: clearChatHistory,
    
    // Grammar
    checkGrammar,
    
    // Vocabulary
    getWordDefinition,
    
    // Text processing
    simplifyText,
    translateText,
    
    // Quiz
    generateQuiz,
    
    // Settings
    updateSettings: updateAISettings,
    
    // Initialize
    init: initAI
};

// Make AI globally available
window.ai = ai;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ai;
}
