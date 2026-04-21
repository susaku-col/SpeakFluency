// ============================================
// SpeakFlow SRS (Spaced Repetition System) Module
// Vocabulary Learning with SRS Algorithm
// ============================================

// ============================================
// SRS State Management
// ============================================

const SRSState = {
    isInitialized: false,
    userId: null,
    cards: [],
    dueCards: [],
    currentSession: null,
    currentCardIndex: 0,
    stats: {
        totalCards: 0,
        masteredCards: 0,
        learningCards: 0,
        dueToday: 0,
        retentionRate: 0,
        streak: 0
    },
    settings: {
        dailyGoal: 20,
        newCardsPerDay: 10,
        maxReviews: 50,
        autoPlayAudio: true,
        showExample: true
    }
};

// ============================================
// Constants
// ============================================

const REVIEW_RESULTS = {
    AGAIN: 0,
    HARD: 1,
    GOOD: 2,
    EASY: 3
};

const PROFICIENCY_LEVELS = {
    NEW: 0,
    LEARNING: 1,
    REVIEWING: 2,
    FAMILIAR: 3,
    MASTERED: 4
};

const RESULT_LABELS = {
    [REVIEW_RESULTS.AGAIN]: 'Again',
    [REVIEW_RESULTS.HARD]: 'Hard',
    [REVIEW_RESULTS.GOOD]: 'Good',
    [REVIEW_RESULTS.EASY]: 'Easy'
};

const RESULT_COLORS = {
    [REVIEW_RESULTS.AGAIN]: '#ef4444',
    [REVIEW_RESULTS.HARD]: '#f59e0b',
    [REVIEW_RESULTS.GOOD]: '#10b981',
    [REVIEW_RESULTS.EASY]: '#3b82f6'
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get user ID from auth
 */
const getUserId = () => {
    return auth?.user?.id || localStorage.getItem('user_id') || null;
};

/**
 * Show toast notification
 */
const showToast = (message, type = 'info', title = null) => {
    if (window.showToast) {
        window.showToast(message, type, title);
    } else {
        console.log(`[SRS] ${type}: ${message}`);
    }
};

/**
 * Save SRS data to localStorage
 */
const saveToLocalStorage = () => {
    localStorage.setItem('srs_cards', JSON.stringify(SRSState.cards));
    localStorage.setItem('srs_stats', JSON.stringify(SRSState.stats));
    localStorage.setItem('srs_settings', JSON.stringify(SRSState.settings));
};

/**
 * Load SRS data from localStorage
 */
const loadFromLocalStorage = () => {
    const savedCards = localStorage.getItem('srs_cards');
    const savedStats = localStorage.getItem('srs_stats');
    const savedSettings = localStorage.getItem('srs_settings');
    
    if (savedCards) {
        SRSState.cards = JSON.parse(savedCards);
    }
    if (savedStats) {
        SRSState.stats = JSON.parse(savedStats);
    }
    if (savedSettings) {
        SRSState.settings = { ...SRSState.settings, ...JSON.parse(savedSettings) };
    }
};

// ============================================
// API Calls
// ============================================

/**
 * Fetch user's vocabulary cards
 */
const fetchCards = async () => {
    try {
        const response = await fetch('/api/vocabulary/cards', {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            SRSState.cards = data.data.cards;
            SRSState.stats = data.data.stats;
            updateStats();
            return SRSState.cards;
        }
        return [];
    } catch (error) {
        console.error('Fetch cards error:', error);
        loadFromLocalStorage();
        return SRSState.cards;
    }
};

/**
 * Get due cards for review
 */
const getDueCards = async () => {
    try {
        const response = await fetch('/api/vocabulary/due', {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            SRSState.dueCards = data.data.cards;
            SRSState.stats.dueToday = data.data.count;
            return SRSState.dueCards;
        }
        return [];
    } catch (error) {
        console.error('Get due cards error:', error);
        // Use local calculation
        const now = new Date();
        SRSState.dueCards = SRSState.cards.filter(card => {
            const nextReview = new Date(card.nextReviewDate);
            return nextReview <= now && card.proficiency !== PROFICIENCY_LEVELS.MASTERED;
        });
        SRSState.stats.dueToday = SRSState.dueCards.length;
        return SRSState.dueCards;
    }
};

/**
 * Submit review result
 */
const submitReview = async (cardId, quality, responseTime) => {
    try {
        const response = await fetch('/api/vocabulary/review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({
                cardId,
                quality,
                responseTime
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update local card
            const cardIndex = SRSState.cards.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
                SRSState.cards[cardIndex] = data.data.card;
            }
            updateStats();
            saveToLocalStorage();
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Submit review error:', error);
        return null;
    }
};

/**
 * Add new vocabulary word
 */
const addVocabulary = async (word, translation, example = '') => {
    try {
        const response = await fetch('/api/vocabulary/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({
                word,
                translation,
                example
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            SRSState.cards.unshift(data.data.card);
            updateStats();
            saveToLocalStorage();
            showToast(`Added "${word}" to your vocabulary!`, 'success');
            return data.data.card;
        }
        return null;
    } catch (error) {
        console.error('Add vocabulary error:', error);
        return null;
    }
};

/**
 * Delete vocabulary card
 */
const deleteCard = async (cardId) => {
    try {
        const response = await fetch(`/api/vocabulary/cards/${cardId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            SRSState.cards = SRSState.cards.filter(c => c.id !== cardId);
            updateStats();
            saveToLocalStorage();
            showToast('Card deleted', 'info');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Delete card error:', error);
        return false;
    }
};

// ============================================
// Review Session Management
// ============================================

/**
 * Start a review session
 */
const startReviewSession = async () => {
    await getDueCards();
    
    if (SRSState.dueCards.length === 0) {
        showToast('No cards due for review! Come back later.', 'success', 'All Caught Up! 🎉');
        return false;
    }
    
    // Limit number of cards per session
    const maxCards = Math.min(SRSState.dueCards.length, SRSState.settings.maxReviews);
    SRSState.currentSession = {
        cards: SRSState.dueCards.slice(0, maxCards),
        startTime: Date.now(),
        correctCount: 0,
        totalCount: maxCards
    };
    SRSState.currentCardIndex = 0;
    
    showReviewCard();
    return true;
};

/**
 * Show current review card
 */
const showReviewCard = () => {
    const container = document.getElementById('srs-card-container');
    if (!container) return;
    
    if (SRSState.currentCardIndex >= SRSState.currentSession.cards.length) {
        endReviewSession();
        return;
    }
    
    const card = SRSState.currentSession.cards[SRSState.currentCardIndex];
    const progress = ((SRSState.currentCardIndex) / SRSState.currentSession.cards.length) * 100;
    
    container.innerHTML = `
        <div class="srs-card">
            <div class="srs-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <span class="progress-text">${SRSState.currentCardIndex + 1} / ${SRSState.currentSession.cards.length}</span>
            </div>
            
            <div class="card-front">
                <div class="card-word">${escapeHtml(card.word)}</div>
                ${card.pronunciation ? `<div class="card-pronunciation">/${card.pronunciation}/</div>` : ''}
                <button class="btn btn-outline btn-sm" onclick="srs.playAudio('${card.word}')">🔊 Listen</button>
            </div>
            
            <div class="card-back" style="display: none;">
                <div class="card-translation">${escapeHtml(card.translation)}</div>
                ${card.example ? `<div class="card-example">"${escapeHtml(card.example)}"</div>` : ''}
                ${card.partOfSpeech ? `<div class="card-part">${card.partOfSpeech}</div>` : ''}
            </div>
            
            <div class="card-actions">
                <button class="btn btn-primary" onclick="srs.revealCard()">Show Answer</button>
            </div>
        </div>
    `;
};

/**
 * Reveal card answer
 */
const revealCard = () => {
    const cardFront = document.querySelector('.card-front');
    const cardBack = document.querySelector('.card-back');
    const actions = document.querySelector('.card-actions');
    
    if (cardFront && cardBack) {
        cardFront.style.display = 'none';
        cardBack.style.display = 'block';
        
        actions.innerHTML = `
            <button class="btn btn-review again" onclick="srs.rateCard(${REVIEW_RESULTS.AGAIN})">
                ${RESULT_LABELS[REVIEW_RESULTS.AGAIN]}
            </button>
            <button class="btn btn-review hard" onclick="srs.rateCard(${REVIEW_RESULTS.HARD})">
                ${RESULT_LABELS[REVIEW_RESULTS.HARD]}
            </button>
            <button class="btn btn-review good" onclick="srs.rateCard(${REVIEW_RESULTS.GOOD})">
                ${RESULT_LABELS[REVIEW_RESULTS.GOOD]}
            </button>
            <button class="btn btn-review easy" onclick="srs.rateCard(${REVIEW_RESULTS.EASY})">
                ${RESULT_LABELS[REVIEW_RESULTS.EASY]}
            </button>
        `;
    }
};

/**
 * Rate current card
 */
const rateCard = async (quality) => {
    const card = SRSState.currentSession.cards[SRSState.currentCardIndex];
    const startTime = SRSState.currentSession.startTime;
    const responseTime = (Date.now() - startTime) / 1000;
    
    // Record correct answer for stats
    if (quality >= REVIEW_RESULTS.GOOD) {
        SRSState.currentSession.correctCount++;
    }
    
    // Submit review to backend
    await submitReview(card.id, quality, responseTime);
    
    // Move to next card
    SRSState.currentCardIndex++;
    showReviewCard();
    
    // Track progress
    updateSessionProgress();
};

/**
 * Update session progress
 */
const updateSessionProgress = () => {
    const progress = SRSState.currentSession;
    const remaining = progress.totalCount - progress.currentCardIndex;
    
    if (remaining > 0) {
        const progressBar = document.querySelector('.srs-progress .progress-fill');
        if (progressBar) {
            const percentage = (progress.currentCardIndex / progress.totalCount) * 100;
            progressBar.style.width = `${percentage}%`;
        }
        
        const progressText = document.querySelector('.srs-progress .progress-text');
        if (progressText) {
            progressText.textContent = `${progress.currentCardIndex + 1} / ${progress.totalCount}`;
        }
    }
};

/**
 * End review session
 */
const endReviewSession = () => {
    const session = SRSState.currentSession;
    const accuracy = (session.correctCount / session.totalCount) * 100;
    const duration = Math.round((Date.now() - session.startTime) / 1000);
    
    showToast(`Session complete! ${session.correctCount}/${session.totalCount} correct (${Math.round(accuracy)}%)`, 'success', 'Great Work! 🎉');
    
    // Show session summary
    const container = document.getElementById('srs-card-container');
    if (container) {
        container.innerHTML = `
            <div class="session-summary">
                <h3>Review Session Complete!</h3>
                <div class="summary-stats">
                    <div class="stat">
                        <span class="stat-value">${session.totalCount}</span>
                        <span class="stat-label">Cards Reviewed</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${session.correctCount}</span>
                        <span class="stat-label">Correct</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${Math.round(accuracy)}%</span>
                        <span class="stat-label">Accuracy</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}</span>
                        <span class="stat-label">Time</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="srs.startReview()">Start Another Session</button>
                <button class="btn btn-outline" onclick="srs.showDashboard()">Back to Dashboard</button>
            </div>
        `;
    }
    
    SRSState.currentSession = null;
    updateStats();
};

/**
 * Play audio for word
 */
const playAudio = (word) => {
    if (window.voice && window.voice.textToSpeech) {
        window.voice.textToSpeech(word);
    } else {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    }
};

// ============================================
// Dashboard & Stats
// ============================================

/**
 * Update statistics
 */
const updateStats = () => {
    const totalCards = SRSState.cards.length;
    const masteredCards = SRSState.cards.filter(c => c.proficiency === PROFICIENCY_LEVELS.MASTERED).length;
    const learningCards = SRSState.cards.filter(c => c.proficiency === PROFICIENCY_LEVELS.LEARNING || c.proficiency === PROFICIENCY_LEVELS.REVIEWING).length;
    const dueToday = SRSState.cards.filter(c => {
        const nextReview = new Date(c.nextReviewDate);
        return nextReview <= new Date() && c.proficiency !== PROFICIENCY_LEVELS.MASTERED;
    }).length;
    
    // Calculate retention rate (based on last 100 reviews)
    const recentReviews = SRSState.cards.flatMap(c => c.reviewHistory || []).slice(-100);
    const correctReviews = recentReviews.filter(r => r.result >= REVIEW_RESULTS.GOOD).length;
    const retentionRate = recentReviews.length > 0 ? (correctReviews / recentReviews.length) * 100 : 0;
    
    SRSState.stats = {
        totalCards,
        masteredCards,
        learningCards,
        dueToday,
        retentionRate: Math.round(retentionRate),
        streak: calculateStreak()
    };
    
    saveToLocalStorage();
    renderDashboard();
};

/**
 * Calculate learning streak
 */
const calculateStreak = () => {
    const reviewDates = SRSState.cards
        .flatMap(c => c.reviewHistory || [])
        .map(r => new Date(r.date).toDateString());
    const uniqueDates = [...new Set(reviewDates)].sort();
    
    let streak = 0;
    let currentStreak = 0;
    let lastDate = null;
    
    for (const date of uniqueDates.reverse()) {
        if (!lastDate) {
            currentStreak = 1;
        } else {
            const diff = (new Date(lastDate) - new Date(date)) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
                currentStreak++;
            } else {
                break;
            }
        }
        lastDate = date;
        streak = Math.max(streak, currentStreak);
    }
    
    return streak;
};

/**
 * Render dashboard
 */
const renderDashboard = () => {
    const container = document.getElementById('srs-dashboard');
    if (!container) return;
    
    container.innerHTML = `
        <div class="srs-stats-grid">
            <div class="stat-card">
                <div class="stat-value">${SRSState.stats.totalCards}</div>
                <div class="stat-label">Total Cards</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${SRSState.stats.masteredCards}</div>
                <div class="stat-label">Mastered</div>
                <div class="stat-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(SRSState.stats.masteredCards / SRSState.stats.totalCards) * 100}%"></div>
                    </div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${SRSState.stats.dueToday}</div>
                <div class="stat-label">Due Today</div>
                <button class="btn btn-primary btn-sm" onclick="srs.startReview()">Review Now</button>
            </div>
            <div class="stat-card">
                <div class="stat-value">${SRSState.stats.retentionRate}%</div>
                <div class="stat-label">Retention Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">🔥 ${SRSState.stats.streak}</div>
                <div class="stat-label">Day Streak</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${SRSState.stats.learningCards}</div>
                <div class="stat-label">Learning</div>
            </div>
        </div>
        
        <div class="srs-proficiency-chart">
            <h4>Proficiency Distribution</h4>
            <div class="proficiency-bars">
                <div class="proficiency-item">
                    <span class="proficiency-label">New</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${getProficiencyPercentage(PROFICIENCY_LEVELS.NEW)}%; background: #9ca3af"></div>
                    </div>
                    <span class="proficiency-count">${getProficiencyCount(PROFICIENCY_LEVELS.NEW)}</span>
                </div>
                <div class="proficiency-item">
                    <span class="proficiency-label">Learning</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${getProficiencyPercentage(PROFICIENCY_LEVELS.LEARNING)}%; background: #f59e0b"></div>
                    </div>
                    <span class="proficiency-count">${getProficiencyCount(PROFICIENCY_LEVELS.LEARNING)}</span>
                </div>
                <div class="proficiency-item">
                    <span class="proficiency-label">Reviewing</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${getProficiencyPercentage(PROFICIENCY_LEVELS.REVIEWING)}%; background: #3b82f6"></div>
                    </div>
                    <span class="proficiency-count">${getProficiencyCount(PROFICIENCY_LEVELS.REVIEWING)}</span>
                </div>
                <div class="proficiency-item">
                    <span class="proficiency-label">Familiar</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${getProficiencyPercentage(PROFICIENCY_LEVELS.FAMILIAR)}%; background: #10b981"></div>
                    </div>
                    <span class="proficiency-count">${getProficiencyCount(PROFICIENCY_LEVELS.FAMILIAR)}</span>
                </div>
                <div class="proficiency-item">
                    <span class="proficiency-label">Mastered</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${getProficiencyPercentage(PROFICIENCY_LEVELS.MASTERED)}%; background: #8b5cf6"></div>
                    </div>
                    <span class="proficiency-count">${getProficiencyCount(PROFICIENCY_LEVELS.MASTERED)}</span>
                </div>
            </div>
        </div>
        
        <div class="srs-review-forecast">
            <h4>Review Forecast</h4>
            <div class="forecast-chart" id="forecast-chart"></div>
        </div>
        
        <div class="srs-settings">
            <h4>Settings</h4>
            <div class="settings-item">
                <label>Daily Review Goal</label>
                <input type="number" id="daily-goal" value="${SRSState.settings.dailyGoal}" min="5" max="100">
            </div>
            <div class="settings-item">
                <label>New Cards Per Day</label>
                <input type="number" id="new-cards" value="${SRSState.settings.newCardsPerDay}" min="1" max="20">
            </div>
            <div class="settings-item">
                <label>Auto-play Audio</label>
                <label class="switch">
                    <input type="checkbox" id="auto-play" ${SRSState.settings.autoPlayAudio ? 'checked' : ''}>
                    <span class="switch-slider"></span>
                </label>
            </div>
            <button class="btn btn-primary" onclick="srs.saveSettings()">Save Settings</button>
        </div>
    `;
    
    // Render forecast chart
    renderForecastChart();
    
    // Setup settings listeners
    document.getElementById('daily-goal')?.addEventListener('change', (e) => {
        SRSState.settings.dailyGoal = parseInt(e.target.value);
    });
    document.getElementById('new-cards')?.addEventListener('change', (e) => {
        SRSState.settings.newCardsPerDay = parseInt(e.target.value);
    });
    document.getElementById('auto-play')?.addEventListener('change', (e) => {
        SRSState.settings.autoPlayAudio = e.target.checked;
    });
};

/**
 * Get count of cards at proficiency level
 */
const getProficiencyCount = (level) => {
    return SRSState.cards.filter(c => c.proficiency === level).length;
};

/**
 * Get percentage of cards at proficiency level
 */
const getProficiencyPercentage = (level) => {
    if (SRSState.stats.totalCards === 0) return 0;
    return (getProficiencyCount(level) / SRSState.stats.totalCards) * 100;
};

/**
 * Render forecast chart
 */
const renderForecastChart = () => {
    const container = document.getElementById('forecast-chart');
    if (!container) return;
    
    const forecast = [];
    const today = new Date();
    
    for (let i = 0; i <= 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dueCount = SRSState.cards.filter(c => {
            const nextReview = new Date(c.nextReviewDate);
            return nextReview <= date && c.proficiency !== PROFICIENCY_LEVELS.MASTERED;
        }).length;
        forecast.push({ date: date.toLocaleDateString('en', { weekday: 'short' }), count: dueCount });
    }
    
    const maxCount = Math.max(...forecast.map(f => f.count), 1);
    
    container.innerHTML = `
        <div class="forecast-bars">
            ${forecast.map(f => `
                <div class="forecast-bar">
                    <div class="bar" style="height: ${(f.count / maxCount) * 100}%"></div>
                    <span class="label">${f.date}</span>
                    <span class="count">${f.count}</span>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Show dashboard
 */
const showDashboard = () => {
    const container = document.getElementById('srs-card-container');
    if (container) {
        container.innerHTML = '<div id="srs-dashboard"></div>';
        renderDashboard();
    }
};

/**
 * Save settings
 */
const saveSettings = () => {
    localStorage.setItem('srs_settings', JSON.stringify(SRSState.settings));
    showToast('Settings saved!', 'success');
};

// ============================================
// Vocabulary List
// ============================================

/**
 * Show vocabulary list
 */
const showVocabularyList = () => {
    const container = document.getElementById('srs-card-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="vocabulary-header">
            <h3>My Vocabulary</h3>
            <button class="btn btn-primary" onclick="srs.showAddWordModal()">+ Add Word</button>
        </div>
        <div class="vocabulary-search">
            <input type="text" id="vocab-search" class="form-input" placeholder="Search words...">
        </div>
        <div class="vocabulary-filters">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="new">New</button>
            <button class="filter-btn" data-filter="learning">Learning</button>
            <button class="filter-btn" data-filter="mastered">Mastered</button>
            <button class="filter-btn" data-filter="due">Due</button>
        </div>
        <div id="vocabulary-list" class="vocabulary-list"></div>
    `;
    
    renderVocabularyList();
    
    // Setup search
    const searchInput = document.getElementById('vocab-search');
    searchInput.addEventListener('input', () => renderVocabularyList(searchInput.value));
    
    // Setup filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderVocabularyList(searchInput.value, btn.dataset.filter);
        });
    });
};

/**
 * Render vocabulary list
 */
const renderVocabularyList = (search = '', filter = 'all') => {
    const container = document.getElementById('vocabulary-list');
    if (!container) return;
    
    let filteredCards = [...SRSState.cards];
    
    // Apply search
    if (search) {
        const term = search.toLowerCase();
        filteredCards = filteredCards.filter(c => 
            c.word.toLowerCase().includes(term) || 
            c.translation.toLowerCase().includes(term)
        );
    }
    
    // Apply filter
    switch (filter) {
        case 'new':
            filteredCards = filteredCards.filter(c => c.proficiency === PROFICIENCY_LEVELS.NEW);
            break;
        case 'learning':
            filteredCards = filteredCards.filter(c => c.proficiency === PROFICIENCY_LEVELS.LEARNING || c.proficiency === PROFICIENCY_LEVELS.REVIEWING);
            break;
        case 'mastered':
            filteredCards = filteredCards.filter(c => c.proficiency === PROFICIENCY_LEVELS.MASTERED);
            break;
        case 'due':
            filteredCards = filteredCards.filter(c => {
                const nextReview = new Date(c.nextReviewDate);
                return nextReview <= new Date() && c.proficiency !== PROFICIENCY_LEVELS.MASTERED;
            });
            break;
    }
    
    if (filteredCards.length === 0) {
        container.innerHTML = '<p class="no-results">No vocabulary cards found.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="vocabulary-grid">
            ${filteredCards.map(card => `
                <div class="vocab-card" data-id="${card.id}">
                    <div class="vocab-word">${escapeHtml(card.word)}</div>
                    <div class="vocab-translation">${escapeHtml(card.translation)}</div>
                    <div class="vocab-meta">
                        <span class="proficiency proficiency-${card.proficiency}">${getProficiencyLabel(card.proficiency)}</span>
                        <span class="next-review">Next: ${formatDate(card.nextReviewDate)}</span>
                    </div>
                    <div class="vocab-actions">
                        <button class="btn-icon" onclick="srs.playAudio('${card.word}')">🔊</button>
                        <button class="btn-icon" onclick="srs.editCard('${card.id}')">✏️</button>
                        <button class="btn-icon delete" onclick="srs.deleteCard('${card.id}')">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Get proficiency label
 */
const getProficiencyLabel = (level) => {
    const labels = {
        [PROFICIENCY_LEVELS.NEW]: 'New',
        [PROFICIENCY_LEVELS.LEARNING]: 'Learning',
        [PROFICIENCY_LEVELS.REVIEWING]: 'Reviewing',
        [PROFICIENCY_LEVELS.FAMILIAR]: 'Familiar',
        [PROFICIENCY_LEVELS.MASTERED]: 'Mastered'
    };
    return labels[level] || 'Unknown';
};

/**
 * Show add word modal
 */
const showAddWordModal = () => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Add New Word</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="add-word-form">
                    <div class="form-group">
                        <label class="form-label">Word</label>
                        <input type="text" name="word" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Translation</label>
                        <input type="text" name="translation" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Example Sentence (optional)</label>
                        <textarea name="example" class="form-textarea" rows="2"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Add Word</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    const form = modal.querySelector('#add-word-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const word = form.querySelector('[name="word"]').value;
        const translation = form.querySelector('[name="translation"]').value;
        const example = form.querySelector('[name="example"]').value;
        
        await addVocabulary(word, translation, example);
        closeModal();
        showVocabularyList();
    });
};

/**
 * Edit card
 */
const editCard = async (cardId) => {
    const card = SRSState.cards.find(c => c.id === cardId);
    if (!card) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Edit Word</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="edit-word-form">
                    <div class="form-group">
                        <label class="form-label">Word</label>
                        <input type="text" name="word" class="form-input" value="${escapeHtml(card.word)}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Translation</label>
                        <input type="text" name="translation" class="form-input" value="${escapeHtml(card.translation)}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Example Sentence</label>
                        <textarea name="example" class="form-textarea" rows="2">${escapeHtml(card.example || '')}</textarea>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Save Changes</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    
    const form = modal.querySelector('#edit-word-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // In production, call API to update
        card.word = form.querySelector('[name="word"]').value;
        card.translation = form.querySelector('[name="translation"]').value;
        card.example = form.querySelector('[name="example"]').value;
        
        saveToLocalStorage();
        closeModal();
        showVocabularyList();
        showToast('Word updated!', 'success');
    });
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize SRS module
 */
const initSRS = async () => {
    if (SRSState.isInitialized) return;
    
    console.log('Initializing SRS module...');
    
    SRSState.userId = getUserId();
    
    // Load data
    loadFromLocalStorage();
    await fetchCards();
    
    // Render dashboard
    renderDashboard();
    
    SRSState.isInitialized = true;
    
    console.log('SRS module initialized');
};

// ============================================
// Export SRS Module
// ============================================

const srs = {
    // State
    get isInitialized() { return SRSState.isInitialized; },
    get cards() { return SRSState.cards; },
    get stats() { return SRSState.stats; },
    
    // Session management
    startReview: startReviewSession,
    revealCard,
    rateCard,
    
    // Card management
    addVocabulary,
    deleteCard,
    editCard,
    
    // Dashboard
    showDashboard,
    showVocabularyList,
    
    // Audio
    playAudio,
    
    // Settings
    saveSettings,
    
    // Initialize
    init: initSRS
};

// Make srs globally available
window.srs = srs;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSRS);
} else {
    initSRS();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = srs;
}
