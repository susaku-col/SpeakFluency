/* ============================================
   SPEAKFLOW - SESSIONS MODULE
   Version: 1.0.0
   Handles practice sessions, tracking, and session analytics
   ============================================ */

const { validationResult } = require('express-validator');
const { body, param, query } = require('express-validator');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const SessionsConfig = {
    session: {
        maxDuration: 3600, // 1 hour in seconds
        minDuration: 5, // 5 seconds minimum
        defaultDuration: 60, // 60 seconds default
        maxRetries: 3
    },
    scoring: {
        weights: {
            pronunciation: 0.40,
            fluency: 0.30,
            grammar: 0.20,
            vocabulary: 0.10
        },
        thresholds: {
            excellent: 85,
            good: 70,
            fair: 50,
            poor: 30
        }
    },
    feedback: {
        maxLength: 500,
        templates: {
            excellent: "Excellent! Your pronunciation is very clear and natural.",
            good: "Good job! A few areas need improvement.",
            fair: "Fair effort. Focus on the key areas below.",
            poor: "Keep practicing! Let's work on the basics."
        }
    },
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    },
    cache: {
        ttl: 300, // 5 minutes
        maxSize: 1000
    }
};

// ============================================
// DATABASE MODELS (Simulated)
// ============================================

class SessionModel {
    constructor() {
        this.sessions = [];
        this.sessionAnalytics = new Map();
    }
    
    async create(sessionData) {
        const session = {
            id: this.sessions.length + 1,
            sessionId: this.generateSessionId(),
            userId: sessionData.userId,
            type: sessionData.type || 'practice',
            transcript: sessionData.transcript || '',
            expectedText: sessionData.expectedText || null,
            scores: {
                pronunciation: sessionData.scores?.pronunciation || 0,
                fluency: sessionData.scores?.fluency || 0,
                grammar: sessionData.scores?.grammar || 0,
                vocabulary: sessionData.scores?.vocabulary || 0,
                total: sessionData.scores?.total || 0
            },
            feedback: sessionData.feedback || null,
            duration: sessionData.duration || 0,
            audioUrl: sessionData.audioUrl || null,
            deviceInfo: sessionData.deviceInfo || null,
            location: sessionData.location || null,
            tags: sessionData.tags || [],
            metadata: sessionData.metadata || {},
            status: 'completed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.sessions.push(session);
        
        // Update analytics
        await this.updateAnalytics(session.userId, session);
        
        return session;
    }
    
    generateSessionId() {
        return `sess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    async findById(id) {
        return this.sessions.find(s => s.id === parseInt(id));
    }
    
    async findBySessionId(sessionId) {
        return this.sessions.find(s => s.sessionId === sessionId);
    }
    
    async findByUserId(userId, options = {}) {
        let results = this.sessions.filter(s => s.userId === parseInt(userId));
        
        // Apply date filters
        if (options.startDate) {
            results = results.filter(s => new Date(s.createdAt) >= new Date(options.startDate));
        }
        if (options.endDate) {
            results = results.filter(s => new Date(s.createdAt) <= new Date(options.endDate));
        }
        
        // Apply type filter
        if (options.type) {
            results = results.filter(s => s.type === options.type);
        }
        
        // Apply score filter
        if (options.minScore) {
            results = results.filter(s => s.scores.total >= options.minScore);
        }
        
        // Apply sorting
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        // Apply pagination
        const page = options.page || 1;
        const limit = Math.min(options.limit || SessionsConfig.pagination.defaultLimit, SessionsConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            sessions: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async update(id, updates) {
        const index = this.sessions.findIndex(s => s.id === parseInt(id));
        if (index === -1) return null;
        
        const allowedUpdates = ['transcript', 'scores', 'feedback', 'duration', 'audioUrl', 'status', 'metadata'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        this.sessions[index] = {
            ...this.sessions[index],
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        };
        
        // Update analytics
        await this.updateAnalytics(this.sessions[index].userId, this.sessions[index]);
        
        return this.sessions[index];
    }
    
    async delete(id) {
        const index = this.sessions.findIndex(s => s.id === parseInt(id));
        if (index === -1) return false;
        
        const session = this.sessions[index];
        this.sessions.splice(index, 1);
        
        // Update analytics
        await this.updateAnalytics(session.userId, null, true);
        
        return true;
    }
    
    async updateAnalytics(userId, session, isDelete = false) {
        let analytics = this.sessionAnalytics.get(userId);
        
        if (!analytics) {
            analytics = {
                userId,
                totalSessions: 0,
                totalDuration: 0,
                averageScore: 0,
                bestScore: 0,
                worstScore: 100,
                scoresHistory: [],
                categoryAverages: {
                    pronunciation: 0,
                    fluency: 0,
                    grammar: 0,
                    vocabulary: 0
                },
                lastSessionDate: null,
                weeklyStats: {},
                monthlyStats: {}
            };
        }
        
        if (isDelete && session) {
            analytics.totalSessions--;
            analytics.totalDuration -= session.duration;
            
            // Remove from scores history
            const scoreIndex = analytics.scoresHistory.findIndex(s => s.id === session.id);
            if (scoreIndex !== -1) {
                analytics.scoresHistory.splice(scoreIndex, 1);
            }
            
            // Recalculate averages
            if (analytics.scoresHistory.length > 0) {
                const totalScore = analytics.scoresHistory.reduce((sum, s) => sum + s.score, 0);
                analytics.averageScore = totalScore / analytics.scoresHistory.length;
                analytics.bestScore = Math.max(...analytics.scoresHistory.map(s => s.score));
                analytics.worstScore = Math.min(...analytics.scoresHistory.map(s => s.score));
            } else {
                analytics.averageScore = 0;
                analytics.bestScore = 0;
                analytics.worstScore = 100;
            }
        } else if (session) {
            analytics.totalSessions++;
            analytics.totalDuration += session.duration;
            analytics.scoresHistory.push({
                id: session.id,
                score: session.scores.total,
                date: session.createdAt
            });
            
            // Update score stats
            const scores = analytics.scoresHistory.map(s => s.score);
            analytics.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            analytics.bestScore = Math.max(...scores);
            analytics.worstScore = Math.min(...scores);
            
            // Update category averages
            for (const category of ['pronunciation', 'fluency', 'grammar', 'vocabulary']) {
                const categorySessions = this.sessions.filter(s => 
                    s.userId === userId && s.scores[category] > 0
                );
                if (categorySessions.length > 0) {
                    const total = categorySessions.reduce((sum, s) => sum + s.scores[category], 0);
                    analytics.categoryAverages[category] = total / categorySessions.length;
                }
            }
            
            analytics.lastSessionDate = session.createdAt;
            
            // Update weekly stats
            const weekKey = this.getWeekKey(session.createdAt);
            if (!analytics.weeklyStats[weekKey]) {
                analytics.weeklyStats[weekKey] = { sessions: 0, totalScore: 0 };
            }
            analytics.weeklyStats[weekKey].sessions++;
            analytics.weeklyStats[weekKey].totalScore += session.scores.total;
            
            // Update monthly stats
            const monthKey = this.getMonthKey(session.createdAt);
            if (!analytics.monthlyStats[monthKey]) {
                analytics.monthlyStats[monthKey] = { sessions: 0, totalScore: 0 };
            }
            analytics.monthlyStats[monthKey].sessions++;
            analytics.monthlyStats[monthKey].totalScore += session.scores.total;
        }
        
        this.sessionAnalytics.set(userId, analytics);
        return analytics;
    }
    
    getWeekKey(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + 1) / 7);
        return `${year}-W${week}`;
    }
    
    getMonthKey(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    
    async getAnalytics(userId) {
        return this.sessionAnalytics.get(userId) || null;
    }
    
    async getGlobalStats(options = {}) {
        let sessions = [...this.sessions];
        
        // Apply date filters
        if (options.startDate) {
            sessions = sessions.filter(s => new Date(s.createdAt) >= new Date(options.startDate));
        }
        if (options.endDate) {
            sessions = sessions.filter(s => new Date(s.createdAt) <= new Date(options.endDate));
        }
        
        const totalSessions = sessions.length;
        const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
        const averageScore = totalSessions > 0 
            ? sessions.reduce((sum, s) => sum + s.scores.total, 0) / totalSessions 
            : 0;
        
        const scoreDistribution = {
            excellent: sessions.filter(s => s.scores.total >= SessionsConfig.scoring.thresholds.excellent).length,
            good: sessions.filter(s => s.scores.total >= SessionsConfig.scoring.thresholds.good && s.scores.total < SessionsConfig.scoring.thresholds.excellent).length,
            fair: sessions.filter(s => s.scores.total >= SessionsConfig.scoring.thresholds.fair && s.scores.total < SessionsConfig.scoring.thresholds.good).length,
            poor: sessions.filter(s => s.scores.total < SessionsConfig.scoring.thresholds.fair).length
        };
        
        const categoryAverages = {
            pronunciation: 0,
            fluency: 0,
            grammar: 0,
            vocabulary: 0
        };
        
        for (const category of Object.keys(categoryAverages)) {
            const sessionsWithCategory = sessions.filter(s => s.scores[category] > 0);
            if (sessionsWithCategory.length > 0) {
                categoryAverages[category] = sessionsWithCategory.reduce((sum, s) => sum + s.scores[category], 0) / sessionsWithCategory.length;
            }
        }
        
        return {
            totalSessions,
            totalDuration,
            averageScore: Math.round(averageScore),
            scoreDistribution,
            categoryAverages: {
                pronunciation: Math.round(categoryAverages.pronunciation),
                fluency: Math.round(categoryAverages.fluency),
                grammar: Math.round(categoryAverages.grammar),
                vocabulary: Math.round(categoryAverages.vocabulary)
            }
        };
    }
}

// ============================================
// SESSION SERVICE
// ============================================

class SessionService {
    constructor(sessionModel) {
        this.sessionModel = sessionModel;
    }
    
    async createSession(userId, sessionData) {
        // Validate session data
        this.validateSessionData(sessionData);
        
        // Calculate scores if not provided
        if (!sessionData.scores && sessionData.transcript) {
            sessionData.scores = this.calculateScores(sessionData.transcript, sessionData.expectedText);
            sessionData.feedback = this.generateFeedback(sessionData.scores.total);
        }
        
        // Create session
        const session = await this.sessionModel.create({
            userId,
            ...sessionData
        });
        
        return session;
    }
    
    validateSessionData(data) {
        if (data.duration && (data.duration < SessionsConfig.session.minDuration || data.duration > SessionsConfig.session.maxDuration)) {
            throw new Error(`Duration must be between ${SessionsConfig.session.minDuration} and ${SessionsConfig.session.maxDuration} seconds`);
        }
        
        if (data.transcript && data.transcript.length > 5000) {
            throw new Error('Transcript too long (max 5000 characters)');
        }
        
        if (data.scores) {
            const { total } = data.scores;
            if (total < 0 || total > 100) {
                throw new Error('Score must be between 0 and 100');
            }
        }
    }
    
    calculateScores(transcript, expectedText = null) {
        const words = transcript.toLowerCase().split(' ');
        const uniqueWords = new Set(words);
        
        // Calculate pronunciation score
        let pronunciationScore = 70;
        // Adjust based on common mistakes
        if (transcript.toLowerCase().includes('gonna')) pronunciationScore -= 5;
        if (transcript.toLowerCase().includes('wanna')) pronunciationScore -= 5;
        if (transcript.toLowerCase().includes('gotta')) pronunciationScore -= 5;
        pronunciationScore = Math.min(100, Math.max(0, pronunciationScore + (words.length * 0.5)));
        
        // Calculate fluency score
        let fluencyScore = 60;
        if (words.length > 5) fluencyScore += Math.min(20, words.length);
        if (transcript.includes('...')) fluencyScore -= 10;
        fluencyScore = Math.min(100, Math.max(0, fluencyScore));
        
        // Calculate grammar score
        let grammarScore = 75;
        if (transcript.toLowerCase().includes('ain\'t')) grammarScore -= 10;
        if (transcript.toLowerCase().match(/\bi\s+is\b/i)) grammarScore -= 10;
        grammarScore = Math.min(100, Math.max(0, grammarScore));
        
        // Calculate vocabulary score
        let vocabularyScore = 65;
        vocabularyScore += Math.min(20, uniqueWords.size);
        vocabularyScore = Math.min(100, Math.max(0, vocabularyScore));
        
        // Calculate total weighted score
        const weights = SessionsConfig.scoring.weights;
        const total = 
            pronunciationScore * weights.pronunciation +
            fluencyScore * weights.fluency +
            grammarScore * weights.grammar +
            vocabularyScore * weights.vocabulary;
        
        return {
            pronunciation: Math.round(pronunciationScore),
            fluency: Math.round(fluencyScore),
            grammar: Math.round(grammarScore),
            vocabulary: Math.round(vocabularyScore),
            total: Math.round(total)
        };
    }
    
    generateFeedback(totalScore) {
        let summary = '';
        let strengths = [];
        let improvements = [];
        let tips = [];
        
        if (totalScore >= SessionsConfig.scoring.thresholds.excellent) {
            summary = SessionsConfig.feedback.templates.excellent;
            strengths = [
                'Clear pronunciation',
                'Good speaking pace',
                'Proper sentence structure',
                'Rich vocabulary'
            ];
            tips = [
                'Challenge yourself with advanced topics',
                'Try speaking for longer durations',
                'Learn idiomatic expressions'
            ];
        } else if (totalScore >= SessionsConfig.scoring.thresholds.good) {
            summary = SessionsConfig.feedback.templates.good;
            strengths = [
                'Good effort',
                'Understandable speech',
                'Basic grammar correct'
            ];
            improvements = [
                'Work on word stress',
                'Practice difficult sounds',
                'Expand vocabulary'
            ];
            tips = [
                'Listen to native speakers',
                'Record and compare yourself',
                'Practice minimal pairs'
            ];
        } else if (totalScore >= SessionsConfig.scoring.thresholds.fair) {
            summary = SessionsConfig.feedback.templates.fair;
            improvements = [
                'Basic pronunciation',
                'Sentence structure',
                'Speaking confidence'
            ];
            tips = [
                'Start with simple sentences',
                'Practice daily for 10 minutes',
                'Use shadowing technique'
            ];
        } else {
            summary = SessionsConfig.feedback.templates.poor;
            improvements = [
                'Fundamental sounds',
                'Basic vocabulary',
                'Simple sentence construction'
            ];
            tips = [
                'Review alphabet sounds',
                'Learn common phrases',
                'Practice with slower speech'
            ];
        }
        
        return {
            summary,
            strengths,
            improvements,
            tips,
            timestamp: new Date().toISOString()
        };
    }
    
    async getSession(sessionId, userId) {
        const session = await this.sessionModel.findById(sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (session.userId !== parseInt(userId)) {
            throw new Error('Unauthorized access to session');
        }
        
        return session;
    }
    
    async getUserSessions(userId, options = {}) {
        return await this.sessionModel.findByUserId(userId, options);
    }
    
    async getUserAnalytics(userId) {
        const analytics = await this.sessionModel.getAnalytics(userId);
        
        if (!analytics) {
            return {
                userId,
                totalSessions: 0,
                totalDuration: 0,
                averageScore: 0,
                bestScore: 0,
                worstScore: 0,
                categoryAverages: {
                    pronunciation: 0,
                    fluency: 0,
                    grammar: 0,
                    vocabulary: 0
                },
                recentSessions: [],
                weeklyProgress: [],
                monthlyProgress: []
            };
        }
        
        // Get recent sessions
        const recentSessions = await this.sessionModel.findByUserId(userId, {
            limit: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        
        // Calculate weekly progress
        const weeklyProgress = Object.entries(analytics.weeklyStats)
            .slice(-12)
            .map(([week, stats]) => ({
                week,
                sessions: stats.sessions,
                averageScore: Math.round(stats.totalScore / stats.sessions)
            }));
        
        // Calculate monthly progress
        const monthlyProgress = Object.entries(analytics.monthlyStats)
            .slice(-6)
            .map(([month, stats]) => ({
                month,
                sessions: stats.sessions,
                averageScore: Math.round(stats.totalScore / stats.sessions)
            }));
        
        return {
            userId: analytics.userId,
            totalSessions: analytics.totalSessions,
            totalDuration: analytics.totalDuration,
            averageScore: Math.round(analytics.averageScore),
            bestScore: analytics.bestScore,
            worstScore: analytics.worstScore,
            categoryAverages: {
                pronunciation: Math.round(analytics.categoryAverages.pronunciation),
                fluency: Math.round(analytics.categoryAverages.fluency),
                grammar: Math.round(analytics.categoryAverages.grammar),
                vocabulary: Math.round(analytics.categoryAverages.vocabulary)
            },
            recentSessions: recentSessions.sessions,
            weeklyProgress,
            monthlyProgress,
            lastSessionDate: analytics.lastSessionDate
        };
    }
    
    async getGlobalAnalytics(options = {}) {
        return await this.sessionModel.getGlobalStats(options);
    }
    
    async updateSession(sessionId, userId, updates) {
        const session = await this.sessionModel.findById(sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (session.userId !== parseInt(userId)) {
            throw new Error('Unauthorized access to session');
        }
        
        const allowedUpdates = ['transcript', 'scores', 'feedback', 'duration', 'metadata'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        const updated = await this.sessionModel.update(sessionId, filteredUpdates);
        return updated;
    }
    
    async deleteSession(sessionId, userId) {
        const session = await this.sessionModel.findById(sessionId);
        
        if (!session) {
            throw new Error('Session not found');
        }
        
        if (session.userId !== parseInt(userId)) {
            throw new Error('Unauthorized access to session');
        }
        
        return await this.sessionModel.delete(sessionId);
    }
    
    async exportSessions(userId, format = 'json', options = {}) {
        const sessions = await this.sessionModel.findByUserId(userId, {
            limit: 1000,
            ...options
        });
        
        const exportData = {
            userId,
            exportDate: new Date().toISOString(),
            totalSessions: sessions.total,
            sessions: sessions.sessions
        };
        
        if (format === 'json') {
            return JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(sessions.sessions);
        }
        
        return exportData;
    }
    
    convertToCSV(sessions) {
        const headers = ['id', 'sessionId', 'type', 'duration', 'totalScore', 'pronunciation', 'fluency', 'grammar', 'vocabulary', 'createdAt'];
        const rows = sessions.map(s => [
            s.id,
            s.sessionId,
            s.type,
            s.duration,
            s.scores.total,
            s.scores.pronunciation,
            s.scores.fluency,
            s.scores.grammar,
            s.scores.vocabulary,
            s.createdAt
        ]);
        
        const csvRows = [headers.join(','), ...rows.map(row => row.join(','))];
        return csvRows.join('\n');
    }
}

// ============================================
// VALIDATION RULES
// ============================================

const SessionValidation = {
    createSession: [
        body('type')
            .optional()
            .isIn(['practice', 'challenge', 'test', 'free'])
            .withMessage('Invalid session type'),
        
        body('transcript')
            .optional()
            .isString()
            .isLength({ max: 5000 })
            .withMessage('Transcript too long'),
        
        body('duration')
            .optional()
            .isInt({ min: SessionsConfig.session.minDuration, max: SessionsConfig.session.maxDuration })
            .withMessage(`Duration must be between ${SessionsConfig.session.minDuration} and ${SessionsConfig.session.maxDuration} seconds`),
        
        body('scores')
            .optional()
            .isObject()
            .withMessage('Scores must be an object'),
        
        body('scores.total')
            .optional()
            .isInt({ min: 0, max: 100 })
            .withMessage('Total score must be between 0 and 100'),
        
        body('tags')
            .optional()
            .isArray()
            .withMessage('Tags must be an array'),
        
        body('metadata')
            .optional()
            .isObject()
            .withMessage('Metadata must be an object')
    ],
    
    updateSession: [
        body('transcript')
            .optional()
            .isString()
            .isLength({ max: 5000 })
            .withMessage('Transcript too long'),
        
        body('duration')
            .optional()
            .isInt({ min: SessionsConfig.session.minDuration })
            .withMessage(`Duration must be at least ${SessionsConfig.session.minDuration} seconds`),
        
        body('scores')
            .optional()
            .isObject()
            .withMessage('Scores must be an object'),
        
        body('metadata')
            .optional()
            .isObject()
            .withMessage('Metadata must be an object')
    ],
    
    getSessions: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: SessionsConfig.pagination.maxLimit })
            .withMessage(`Limit must be between 1 and ${SessionsConfig.pagination.maxLimit}`),
        
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid start date'),
        
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid end date'),
        
        query('minScore')
            .optional()
            .isInt({ min: 0, max: 100 })
            .withMessage('Min score must be between 0 and 100'),
        
        query('type')
            .optional()
            .isIn(['practice', 'challenge', 'test', 'free'])
            .withMessage('Invalid session type'),
        
        query('sortBy')
            .optional()
            .isIn(['createdAt', 'duration', 'totalScore'])
            .withMessage('Invalid sort field'),
        
        query('sortOrder')
            .optional()
            .isIn(['asc', 'desc'])
            .withMessage('Sort order must be asc or desc')
    ],
    
    sessionIdParam: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('Invalid session ID')
    ]
};

// ============================================
// SESSION ROUTES
// ============================================

function createSessionRoutes(sessionService, authMiddleware) {
    const router = require('express').Router();
    
    // Create session
    router.post('/', authMiddleware.authenticate, SessionValidation.createSession, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const session = await sessionService.createSession(req.user.id, req.body);
            res.status(201).json(session);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get user sessions
    router.get('/', authMiddleware.authenticate, SessionValidation.getSessions, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || SessionsConfig.pagination.defaultLimit,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            minScore: req.query.minScore ? parseInt(req.query.minScore) : null,
            type: req.query.type,
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const result = await sessionService.getUserSessions(req.user.id, options);
        res.json(result);
    });
    
    // Get user analytics
    router.get('/analytics', authMiddleware.authenticate, async (req, res) => {
        const analytics = await sessionService.getUserAnalytics(req.user.id);
        res.json(analytics);
    });
    
    // Get global analytics (admin only)
    router.get('/analytics/global', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const { startDate, endDate } = req.query;
        const stats = await sessionService.getGlobalAnalytics({ startDate, endDate });
        res.json(stats);
    });
    
    // Get session by ID
    router.get('/:id', authMiddleware.authenticate, SessionValidation.sessionIdParam, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const session = await sessionService.getSession(req.params.id, req.user.id);
            res.json(session);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    
    // Update session
    router.put('/:id', authMiddleware.authenticate, SessionValidation.sessionIdParam, SessionValidation.updateSession, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const updated = await sessionService.updateSession(req.params.id, req.user.id, req.body);
            res.json(updated);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Delete session
    router.delete('/:id', authMiddleware.authenticate, SessionValidation.sessionIdParam, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            await sessionService.deleteSession(req.params.id, req.user.id);
            res.json({ success: true });
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    
    // Export sessions
    router.get('/export/:format', authMiddleware.authenticate, async (req, res) => {
        const format = req.params.format;
        if (!['json', 'csv'].includes(format)) {
            return res.status(400).json({ error: 'Format must be json or csv' });
        }
        
        try {
            const exportData = await sessionService.exportSessions(req.user.id, format, req.query);
            
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=sessions_${Date.now()}.csv`);
                res.send(exportData);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename=sessions_${Date.now()}.json`);
                res.send(exportData);
            }
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    return router;
}

// ============================================
// EXPORTS
// ============================================

const sessionModel = new SessionModel();
const sessionService = new SessionService(sessionModel);
const sessionRoutes = createSessionRoutes(sessionService, require('./auth').authMiddleware);

module.exports = {
    sessionModel,
    sessionService,
    sessionRoutes,
    SessionsConfig,
    SessionValidation
};
