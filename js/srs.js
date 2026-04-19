/* ============================================
   SPEAKFLOW - SPACED REPETITION SYSTEM (SRS)
   Version: 1.0.0
   Handles vocabulary learning with spaced repetition algorithm
   ============================================ */

// ============================================
// SRS CONFIGURATION
// ============================================

const SRSConfig = {
    // SM-2 Algorithm Settings
    sm2: {
        initialInterval: 1,      // days
        easyInterval: 4,          // days
        graduationInterval: 21,   // days
        easeFactor: 2.5,
        minimumEaseFactor: 1.3,
        maximumInterval: 365      // days
    },
    
    // Review Settings
    reviews: {
        maxPerDay: 50,
        newWordsPerDay: 10,
        reviewBatchSize: 20,
        leechThreshold: 5         // reviews before marking as leech
    },
    
    // Difficulty Levels
    difficulties: {
        easy: { initialEase: 2.5, interval: 4 },
        medium: { initialEase: 2.5, interval: 2 },
        hard: { initialEase: 2.2, interval: 1 }
    },
    
    // Proficiency Levels
    proficiency: {
        unknown: 0,
        learning: 1,
        reviewing: 2,
        mastered: 3
    },
    
    // Storage Keys
    storage: {
        words: 'srs_words',
        reviews: 'srs_reviews',
        stats: 'srs_stats'
    }
};

// ============================================
// SRS ALGORITHM (SM-2)
// ============================================

class SRSAlgorithm {
    constructor() {
        this.config = SRSConfig.sm2;
    }
    
    calculateNextReview(card, quality) {
        // Quality ratings (0-5):
        // 0-2: Incorrect (repeat)
        // 3: Hard (partial recall)
        // 4: Good (correct)
        // 5: Easy (perfect recall)
        
        let { interval, easeFactor, repetitions } = card;
        
        // Update ease factor based on quality
        if (quality >= 3) {
            let newEase = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
            easeFactor = Math.max(this.config.minimumEaseFactor, newEase);
        }
        
        // Calculate new interval
        if (quality < 3) {
            // Incorrect - reset
            repetitions = 0;
            interval = 1;
        } else if (repetitions === 0) {
            interval = 1;
            repetitions = 1;
        } else if (repetitions === 1) {
            interval = 6;
            repetitions = 2;
        } else {
            interval = Math.round(interval * easeFactor);
            repetitions++;
        }
        
        // Cap interval at maximum
        interval = Math.min(interval, this.config.maximumInterval);
        
        // Calculate next review date
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + interval);
        
        return {
            interval,
            easeFactor,
            repetitions,
            nextReview,
            quality
        };
    }
    
    calculateRetention(history) {
        if (history.length === 0) return 0;
        
        const correct = history.filter(r => r.quality >= 3).length;
        return (correct / history.length) * 100;
    }
    
    getDueCards(cards, limit = SRSConfig.reviews.maxPerDay) {
        const now = new Date();
        
        return cards
            .filter(card => new Date(card.nextReview) <= now && card.proficiency !== SRSConfig.proficiency.mastered)
            .sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview))
            .slice(0, limit);
    }
    
    getNewCards(cards, limit = SRSConfig.reviews.newWordsPerDay) {
        return cards
            .filter(card => card.proficiency === SRSConfig.proficiency.unknown)
            .slice(0, limit);
    }
    
    isLeech(card) {
        const failedReviews = card.reviewHistory.filter(r => r.quality < 3).length;
        return failedReviews >= SRSConfig.reviews.leechThreshold;
    }
}

// ============================================
// VOCABULARY MANAGER
// ============================================

class VocabularyManager {
    constructor() {
        this.words = new Map();
        this.categories = new Map();
        this.init();
    }
    
    init() {
        this.loadWords();
        this.loadCategories();
        this.loadDefaultWords();
    }
    
    loadWords() {
        const saved = localStorage.getItem(SRSConfig.storage.words);
        if (saved) {
            try {
                const words = JSON.parse(saved);
                words.forEach(word => this.words.set(word.id, word));
            } catch (e) {
                console.error('Failed to load words:', e);
            }
        }
    }
    
    loadCategories() {
        this.categories.set('basic', {
            id: 'basic',
            name: 'Basic Vocabulary',
            description: 'Essential words for beginners',
            icon: '🌟',
            color: '#3b82f6'
        });
        
        this.categories.set('business', {
            id: 'business',
            name: 'Business English',
            description: 'Professional vocabulary for workplace',
            icon: '💼',
            color: '#10b981'
        });
        
        this.categories.set('academic', {
            id: 'academic',
            name: 'Academic Words',
            description: 'Vocabulary for IELTS/TOEFL',
            icon: '📚',
            color: '#8b5cf6'
        });
        
        this.categories.set('daily', {
            id: 'daily',
            name: 'Daily Conversation',
            description: 'Common phrases for everyday use',
            icon: '🗣️',
            color: '#f59e0b'
        });
        
        this.categories.set('idioms', {
            id: 'idioms',
            name: 'Idioms & Phrases',
            description: 'Common English expressions',
            icon: '🎯',
            color: '#ef4444'
        });
    }
    
    loadDefaultWords() {
        if (this.words.size > 0) return;
        
        const defaultWords = [
            // Basic Vocabulary
            { word: 'confident', meaning: 'feeling sure about yourself and your abilities', example: 'She felt confident about the interview.', category: 'basic', difficulty: 'medium', proficiency: 0 },
            { word: 'essential', meaning: 'absolutely necessary or extremely important', example: 'Water is essential for life.', category: 'basic', difficulty: 'medium', proficiency: 0 },
            { word: 'improve', meaning: 'to make something better', example: 'I want to improve my English.', category: 'basic', difficulty: 'easy', proficiency: 0 },
            { word: 'opportunity', meaning: 'a chance to do something', example: 'This is a great opportunity to learn.', category: 'basic', difficulty: 'medium', proficiency: 0 },
            { word: 'challenge', meaning: 'something difficult that tests your abilities', example: 'Learning a new language is a challenge.', category: 'basic', difficulty: 'medium', proficiency: 0 },
            
            // Business Vocabulary
            { word: 'deadline', meaning: 'the time by which something must be finished', example: 'The project deadline is Friday.', category: 'business', difficulty: 'medium', proficiency: 0 },
            { word: 'negotiate', meaning: 'to discuss something to reach an agreement', example: 'We need to negotiate the contract terms.', category: 'business', difficulty: 'hard', proficiency: 0 },
            { word: 'collaborate', meaning: 'to work together with others', example: 'Our teams collaborate on many projects.', category: 'business', difficulty: 'hard', proficiency: 0 },
            
            // Academic Vocabulary
            { word: 'analyze', meaning: 'to examine something in detail', example: 'Students must analyze the data.', category: 'academic', difficulty: 'medium', proficiency: 0 },
            { word: 'significant', meaning: 'important or noticeable', example: 'There was a significant improvement.', category: 'academic', difficulty: 'hard', proficiency: 0 },
            { word: 'consequently', meaning: 'as a result', example: 'He worked hard; consequently, he passed.', category: 'academic', difficulty: 'hard', proficiency: 0 },
            
            // Daily Conversation
            { word: 'catch up', meaning: 'to talk with someone you haven\'t seen recently', example: 'Let\'s catch up over coffee.', category: 'daily', difficulty: 'medium', proficiency: 0 },
            { word: 'figure out', meaning: 'to understand or solve something', example: 'I need to figure out this problem.', category: 'daily', difficulty: 'medium', proficiency: 0 },
            { word: 'run into', meaning: 'to meet someone unexpectedly', example: 'I ran into an old friend today.', category: 'daily', difficulty: 'medium', proficiency: 0 },
            
            // Idioms
            { word: 'break the ice', meaning: 'to make people feel more comfortable', example: 'He told a joke to break the ice.', category: 'idioms', difficulty: 'hard', proficiency: 0 },
            { word: 'hit the nail on the head', meaning: 'to be exactly right', example: 'You hit the nail on the head with that analysis.', category: 'idioms', difficulty: 'hard', proficiency: 0 },
            { word: 'once in a blue moon', meaning: 'very rarely', example: 'I go to the cinema once in a blue moon.', category: 'idioms', difficulty: 'hard', proficiency: 0 }
        ];
        
        for (const wordData of defaultWords) {
            this.addWord(wordData);
        }
        
        this.saveWords();
    }
    
    addWord(wordData) {
        const id = this.generateId();
        const now = new Date();
        
        const word = {
            id,
            ...wordData,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            interval: 0,
            easeFactor: SRSConfig.sm2.easeFactor,
            repetitions: 0,
            nextReview: now.toISOString(),
            reviewHistory: [],
            proficiency: wordData.proficiency || SRSConfig.proficiency.unknown,
            tags: wordData.tags || []
        };
        
        this.words.set(id, word);
        this.saveWords();
        
        return word;
    }
    
    updateWord(wordId, updates) {
        const word = this.words.get(wordId);
        if (!word) return null;
        
        Object.assign(word, updates);
        word.updatedAt = new Date().toISOString();
        this.saveWords();
        
        return word;
    }
    
    deleteWord(wordId) {
        const deleted = this.words.delete(wordId);
        this.saveWords();
        return deleted;
    }
    
    getWord(wordId) {
        return this.words.get(wordId);
    }
    
    getAllWords() {
        return Array.from(this.words.values());
    }
    
    getWordsByCategory(category) {
        return Array.from(this.words.values()).filter(w => w.category === category);
    }
    
    getWordsByDifficulty(difficulty) {
        return Array.from(this.words.values()).filter(w => w.difficulty === difficulty);
    }
    
    getWordsByProficiency(proficiency) {
        return Array.from(this.words.values()).filter(w => w.proficiency === proficiency);
    }
    
    searchWords(query) {
        const lowerQuery = query.toLowerCase();
        
        return Array.from(this.words.values()).filter(word => 
            word.word.toLowerCase().includes(lowerQuery) ||
            word.meaning.toLowerCase().includes(lowerQuery) ||
            (word.example && word.example.toLowerCase().includes(lowerQuery))
        );
    }
    
    getStats() {
        const words = Array.from(this.words.values());
        
        return {
            total: words.length,
            byCategory: this.getStatsByCategory(words),
            byDifficulty: this.getStatsByDifficulty(words),
            byProficiency: this.getStatsByProficiency(words),
            mastered: words.filter(w => w.proficiency === SRSConfig.proficiency.mastered).length,
            learning: words.filter(w => w.proficiency === SRSConfig.proficiency.learning).length,
            reviewing: words.filter(w => w.proficiency === SRSConfig.proficiency.reviewing).length,
            unknown: words.filter(w => w.proficiency === SRSConfig.proficiency.unknown).length
        };
    }
    
    getStatsByCategory(words) {
        const stats = {};
        for (const word of words) {
            if (!stats[word.category]) {
                stats[word.category] = 0;
            }
            stats[word.category]++;
        }
        return stats;
    }
    
    getStatsByDifficulty(words) {
        const stats = { easy: 0, medium: 0, hard: 0 };
        for (const word of words) {
            stats[word.difficulty]++;
        }
        return stats;
    }
    
    getStatsByProficiency(words) {
        const stats = { 0: 0, 1: 0, 2: 0, 3: 0 };
        for (const word of words) {
            stats[word.proficiency]++;
        }
        return stats;
    }
    
    generateId() {
        return `word_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    saveWords() {
        const wordsArray = Array.from(this.words.values());
        localStorage.setItem(SRSConfig.storage.words, JSON.stringify(wordsArray));
    }
    
    importWords(wordsData) {
        for (const wordData of wordsData) {
            this.addWord(wordData);
        }
    }
    
    exportWords() {
        return Array.from(this.words.values());
    }
}

// ============================================
// REVIEW MANAGER
// ============================================

class ReviewManager {
    constructor(vocabularyManager, algorithm) {
        this.vocab = vocabularyManager;
        this.algorithm = algorithm;
        this.reviewQueue = [];
        this.reviewHistory = [];
        this.stats = this.loadStats();
        this.init();
    }
    
    init() {
        this.loadReviewHistory();
        this.updateReviewQueue();
    }
    
    loadReviewHistory() {
        const saved = localStorage.getItem(SRSConfig.storage.reviews);
        if (saved) {
            try {
                this.reviewHistory = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load review history:', e);
            }
        }
    }
    
    loadStats() {
        const saved = localStorage.getItem(SRSConfig.storage.stats);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load stats:', e);
            }
        }
        
        return {
            totalReviews: 0,
            correctReviews: 0,
            streakDays: 0,
            lastReviewDate: null,
            wordsLearned: 0,
            totalTimeSpent: 0 // minutes
        };
    }
    
    updateReviewQueue() {
        const allWords = this.vocab.getAllWords();
        const dueCards = this.algorithm.getDueCards(allWords);
        const newCards = this.algorithm.getNewCards(allWords);
        
        this.reviewQueue = [...dueCards, ...newCards];
        
        // Limit queue size
        if (this.reviewQueue.length > SRSConfig.reviews.reviewBatchSize) {
            this.reviewQueue = this.reviewQueue.slice(0, SRSConfig.reviews.reviewBatchSize);
        }
        
        return this.reviewQueue;
    }
    
    getNextReview() {
        if (this.reviewQueue.length === 0) {
            this.updateReviewQueue();
        }
        
        return this.reviewQueue[0] || null;
    }
    
    submitReview(wordId, quality, responseTime = null) {
        const word = this.vocab.getWord(wordId);
        if (!word) return null;
        
        const review = {
            wordId,
            word: word.word,
            quality,
            responseTime,
            timestamp: new Date().toISOString()
        };
        
        // Calculate next review using SM-2 algorithm
        const card = {
            interval: word.interval,
            easeFactor: word.easeFactor,
            repetitions: word.repetitions
        };
        
        const nextReviewData = this.algorithm.calculateNextReview(card, quality);
        
        // Update word with new SRS data
        word.interval = nextReviewData.interval;
        word.easeFactor = nextReviewData.easeFactor;
        word.repetitions = nextReviewData.repetitions;
        word.nextReview = nextReviewData.nextReview.toISOString();
        word.reviewHistory.push(review);
        
        // Update proficiency based on performance
        if (quality >= 4 && word.repetitions >= 3) {
            word.proficiency = SRSConfig.proficiency.mastered;
        } else if (quality >= 3 && word.repetitions >= 1) {
            word.proficiency = SRSConfig.proficiency.reviewing;
        } else if (quality >= 3) {
            word.proficiency = SRSConfig.proficiency.learning;
        } else if (quality < 3 && word.proficiency !== SRSConfig.proficiency.unknown) {
            word.proficiency = SRSConfig.proficiency.learning;
        }
        
        // Check for leech words
        if (this.algorithm.isLeech(word)) {
            word.isLeech = true;
        }
        
        this.vocab.updateWord(wordId, word);
        
        // Update stats
        this.updateStats(review);
        
        // Add to history
        this.reviewHistory.push(review);
        this.saveReviewHistory();
        
        // Remove from queue
        this.reviewQueue = this.reviewQueue.filter(w => w.id !== wordId);
        
        return {
            word,
            nextReview: nextReviewData.nextReview,
            isCorrect: quality >= 3,
            isLeech: word.isLeech || false
        };
    }
    
    updateStats(review) {
        this.stats.totalReviews++;
        
        if (review.quality >= 3) {
            this.stats.correctReviews++;
        }
        
        if (review.responseTime) {
            this.stats.totalTimeSpent += review.responseTime / 60;
        }
        
        // Update streak
        const today = new Date().toDateString();
        if (this.stats.lastReviewDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (this.stats.lastReviewDate === yesterday.toDateString()) {
                this.stats.streakDays++;
            } else if (this.stats.lastReviewDate !== today) {
                this.stats.streakDays = 1;
            }
            
            this.stats.lastReviewDate = today;
        }
        
        // Update words learned count
        const masteredCount = this.vocab.getWordsByProficiency(SRSConfig.proficiency.mastered).length;
        this.stats.wordsLearned = masteredCount;
        
        this.saveStats();
    }
    
    saveReviewHistory() {
        // Keep only last 1000 reviews
        const recentHistory = this.reviewHistory.slice(-1000);
        localStorage.setItem(SRSConfig.storage.reviews, JSON.stringify(recentHistory));
    }
    
    saveStats() {
        localStorage.setItem(SRSConfig.storage.stats, JSON.stringify(this.stats));
    }
    
    getStats() {
        const retention = (this.stats.correctReviews / this.stats.totalReviews) * 100;
        
        return {
            ...this.stats,
            retentionRate: isNaN(retention) ? 0 : Math.round(retention),
            queueSize: this.reviewQueue.length,
            dueToday: this.reviewQueue.filter(w => new Date(w.nextReview) <= new Date()).length
        };
    }
    
    getReviewHistory(limit = 50) {
        return this.reviewHistory.slice(-limit).reverse();
    }
    
    getPerformanceChartData(days = 30) {
        const data = [];
        const now = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(now.getDate() - i);
            const dateStr = date.toDateString();
            
            const dayReviews = this.reviewHistory.filter(r => 
                new Date(r.timestamp).toDateString() === dateStr
            );
            
            const correct = dayReviews.filter(r => r.quality >= 3).length;
            const total = dayReviews.length;
            
            data.push({
                date: dateStr,
                correct,
                total,
                rate: total > 0 ? (correct / total) * 100 : 0
            });
        }
        
        return data;
    }
    
    resetProgress(wordId) {
        const word = this.vocab.getWord(wordId);
        if (!word) return null;
        
        word.interval = 0;
        word.easeFactor = SRSConfig.sm2.easeFactor;
        word.repetitions = 0;
        word.nextReview = new Date().toISOString();
        word.proficiency = SRSConfig.proficiency.unknown;
        word.reviewHistory = [];
        
        this.vocab.updateWord(wordId, word);
        
        return word;
    }
    
    resetAllProgress() {
        const words = this.vocab.getAllWords();
        for (const word of words) {
            this.resetProgress(word.id);
        }
        
        this.stats = {
            totalReviews: 0,
            correctReviews: 0,
            streakDays: 0,
            lastReviewDate: null,
            wordsLearned: 0,
            totalTimeSpent: 0
        };
        
        this.reviewHistory = [];
        this.saveStats();
        this.saveReviewHistory();
        this.updateReviewQueue();
        
        return true;
    }
}

// ============================================
// SRS UI CONTROLLER
// ============================================

class SRSUIController {
    constructor(vocabularyManager, reviewManager, algorithm) {
        this.vocab = vocabularyManager;
        this.reviewManager = reviewManager;
        this.algorithm = algorithm;
        this.currentCard = null;
        this.isFlipped = false;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.renderDashboard();
        this.loadNextCard();
    }
    
    bindElements() {
        this.elements = {
            wordDisplay: document.getElementById('srsWord'),
            meaningDisplay: document.getElementById('srsMeaning'),
            exampleDisplay: document.getElementById('srsExample'),
            cardContainer: document.getElementById('srsCard'),
            easyBtn: document.getElementById('srsEasyBtn'),
            againBtn: document.getElementById('srsAgainBtn'),
            hardBtn: document.getElementById('srsHardBtn'),
            statsContainer: document.getElementById('srsStats'),
            queueCount: document.getElementById('queueCount'),
            streakDisplay: document.getElementById('streakDisplay'),
            masteredCount: document.getElementById('masteredCount'),
            categoryFilter: document.getElementById('categoryFilter'),
            wordList: document.getElementById('wordList')
        };
    }
    
    bindEvents() {
        if (this.elements.easyBtn) {
            this.elements.easyBtn.addEventListener('click', () => this.submitReview(4));
        }
        
        if (this.elements.againBtn) {
            this.elements.againBtn.addEventListener('click', () => this.submitReview(2));
        }
        
        if (this.elements.hardBtn) {
            this.elements.hardBtn.addEventListener('click', () => this.submitReview(3));
        }
        
        if (this.elements.cardContainer) {
            this.elements.cardContainer.addEventListener('click', () => this.flipCard());
        }
        
        if (this.elements.categoryFilter) {
            this.elements.categoryFilter.addEventListener('change', () => this.filterWords());
        }
    }
    
    loadNextCard() {
        this.currentCard = this.reviewManager.getNextReview();
        
        if (this.currentCard) {
            this.displayCard(this.currentCard);
            this.isFlipped = false;
            this.resetCardFlip();
        } else {
            this.showCompletionMessage();
        }
        
        this.updateQueueInfo();
    }
    
    displayCard(word) {
        if (this.elements.wordDisplay) {
            this.elements.wordDisplay.textContent = word.word;
        }
        
        if (this.elements.meaningDisplay) {
            this.elements.meaningDisplay.textContent = 'Click to reveal meaning';
            this.elements.meaningDisplay.style.opacity = '0.7';
        }
        
        if (this.elements.exampleDisplay && word.example) {
            this.elements.exampleDisplay.textContent = `Example: ${word.example}`;
            this.elements.exampleDisplay.style.display = 'block';
        } else if (this.elements.exampleDisplay) {
            this.elements.exampleDisplay.style.display = 'none';
        }
    }
    
    flipCard() {
        if (!this.currentCard) return;
        
        this.isFlipped = !this.isFlipped;
        
        if (this.isFlipped) {
            if (this.elements.meaningDisplay) {
                this.elements.meaningDisplay.textContent = this.currentCard.meaning;
                this.elements.meaningDisplay.style.opacity = '1';
            }
        } else {
            if (this.elements.meaningDisplay) {
                this.elements.meaningDisplay.textContent = 'Click to reveal meaning';
                this.elements.meaningDisplay.style.opacity = '0.7';
            }
        }
    }
    
    resetCardFlip() {
        if (this.elements.meaningDisplay) {
            this.elements.meaningDisplay.textContent = 'Click to reveal meaning';
            this.elements.meaningDisplay.style.opacity = '0.7';
        }
    }
    
    async submitReview(quality) {
        if (!this.currentCard) return;
        
        // Disable buttons during processing
        this.setButtonsEnabled(false);
        
        // Animate submission
        this.animateSubmission(quality);
        
        // Submit review
        const result = this.reviewManager.submitReview(this.currentCard.id, quality);
        
        // Show feedback
        this.showFeedback(result);
        
        // Load next card
        setTimeout(() => {
            this.loadNextCard();
            this.setButtonsEnabled(true);
            this.renderDashboard();
        }, 500);
    }
    
    animateSubmission(quality) {
        const card = this.elements.cardContainer;
        if (!card) return;
        
        if (quality >= 4) {
            card.style.animation = 'correct-pulse 0.3s ease';
        } else {
            card.style.animation = 'incorrect-shake 0.3s ease';
        }
        
        setTimeout(() => {
            card.style.animation = '';
        }, 300);
    }
    
    showFeedback(result) {
        const feedback = document.createElement('div');
        feedback.className = 'review-feedback';
        
        if (result.isCorrect) {
            feedback.innerHTML = '✅ Great job! +10 XP';
            feedback.style.background = '#10b981';
        } else {
            feedback.innerHTML = '📚 Keep practicing! +5 XP';
            feedback.style.background = '#f59e0b';
        }
        
        if (result.isLeech) {
            feedback.innerHTML += '<br>⚠️ This word needs extra attention';
        }
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
        }, 2000);
        
        // Dispatch XP event
        const event = new CustomEvent('srs:xpGain', {
            detail: { xp: result.isCorrect ? 10 : 5 }
        });
        document.dispatchEvent(event);
    }
    
    setButtonsEnabled(enabled) {
        const buttons = [this.elements.easyBtn, this.elements.againBtn, this.elements.hardBtn];
        buttons.forEach(btn => {
            if (btn) btn.disabled = !enabled;
        });
    }
    
    showCompletionMessage() {
        if (this.elements.wordDisplay) {
            this.elements.wordDisplay.textContent = '🎉 All caught up!';
        }
        if (this.elements.meaningDisplay) {
            this.elements.meaningDisplay.textContent = 'Great job! Come back tomorrow for more words.';
        }
        if (this.elements.exampleDisplay) {
            this.elements.exampleDisplay.style.display = 'none';
        }
    }
    
    renderDashboard() {
        const stats = this.reviewManager.getStats();
        const vocabStats = this.vocab.getStats();
        
        if (this.elements.statsContainer) {
            this.elements.statsContainer.innerHTML = `
                <div class="srs-stats-grid">
                    <div class="stat">
                        <div class="stat-value">${stats.streakDays}</div>
                        <div class="stat-label">Day Streak</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${stats.wordsLearned}</div>
                        <div class="stat-label">Mastered</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${stats.retentionRate}%</div>
                        <div class="stat-label">Retention</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${vocabStats.total}</div>
                        <div class="stat-label">Total Words</div>
                    </div>
                </div>
            `;
        }
        
        if (this.elements.queueCount) {
            this.elements.queueCount.textContent = stats.queueSize;
        }
        
        if (this.elements.streakDisplay) {
            this.elements.streakDisplay.textContent = stats.streakDays;
        }
        
        if (this.elements.masteredCount) {
            this.elements.masteredCount.textContent = stats.wordsLearned;
        }
        
        this.renderWordList();
    }
    
    updateQueueInfo() {
        const stats = this.reviewManager.getStats();
        const queueInfo = document.getElementById('queueInfo');
        if (queueInfo) {
            queueInfo.innerHTML = `
                <span>📚 ${stats.queueSize} words in queue</span>
                <span>✅ ${stats.correctReviews}/${stats.totalReviews} correct</span>
            `;
        }
    }
    
    renderWordList() {
        if (!this.elements.wordList) return;
        
        const category = this.elements.categoryFilter?.value;
        let words = this.vocab.getAllWords();
        
        if (category && category !== 'all') {
            words = words.filter(w => w.category === category);
        }
        
        this.elements.wordList.innerHTML = words.map(word => `
            <div class="word-list-item" data-id="${word.id}">
                <div class="word-info">
                    <span class="word-text">${this.escapeHtml(word.word)}</span>
                    <span class="word-meaning">${this.escapeHtml(word.meaning)}</span>
                </div>
                <div class="word-meta">
                    <span class="word-proficiency proficiency-${word.proficiency}">
                        ${this.getProficiencyLabel(word.proficiency)}
                    </span>
                    <span class="word-category">${word.category}</span>
                    <button class="btn-icon reset-word" data-id="${word.id}">↻</button>
                </div>
            </div>
        `).join('');
        
        // Attach reset handlers
        document.querySelectorAll('.reset-word').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Reset progress for this word?')) {
                    this.reviewManager.resetProgress(id);
                    this.renderWordList();
                    this.renderDashboard();
                }
            });
        });
    }
    
    filterWords() {
        this.renderWordList();
    }
    
    getProficiencyLabel(proficiency) {
        const labels = {
            0: 'Not Started',
            1: 'Learning',
            2: 'Reviewing',
            3: 'Mastered'
        };
        return labels[proficiency] || 'Unknown';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize SRS system
const srsAlgorithm = new SRSAlgorithm();
const vocabularyManager = new VocabularyManager();
const reviewManager = new ReviewManager(vocabularyManager, srsAlgorithm);
const srsUI = new SRSUIController(vocabularyManager, reviewManager, srsAlgorithm);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.SRS = {
    algorithm: srsAlgorithm,
    vocabulary: vocabularyManager,
    reviews: reviewManager,
    ui: srsUI,
    config: SRSConfig
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SRSConfig,
        SRSAlgorithm,
        VocabularyManager,
        ReviewManager,
        SRSUIController
    };
}

// ============================================
// CSS ANIMATIONS
// ============================================

const style = document.createElement('style');
style.textContent = `
    @keyframes correct-pulse {
        0% { transform: scale(1); background: var(--bg-primary); }
        50% { transform: scale(1.02); background: #10b98120; }
        100% { transform: scale(1); background: var(--bg-primary); }
    }
    
    @keyframes incorrect-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    .review-feedback {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 40px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideDown 0.3s ease;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    
    .srs-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 24px;
    }
    
    .word-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid var(--border-light);
        cursor: pointer;
    }
    
    .word-list-item:hover {
        background: var(--bg-tertiary);
    }
    
    .proficiency-0 { color: var(--text-tertiary); }
    .proficiency-1 { color: var(--color-warning); }
    .proficiency-2 { color: var(--color-primary); }
    .proficiency-3 { color: var(--color-success); }
`;

document.head.appendChild(style);

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('SRS module initialized');
    
    // Debug mode
    if (window.location.hostname === 'localhost') {
        window.debugSRS = {
            algorithm: srsAlgorithm,
            vocabulary: vocabularyManager,
            reviews: reviewManager
        };
        console.log('SRS debug mode enabled');
    }
});
