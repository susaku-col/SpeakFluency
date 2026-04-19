/* ============================================
   SPEAKFLOW - USERS MODULE
   Version: 1.0.0
   Handles user management, profiles, preferences, and user analytics
   ============================================ */

const { validationResult } = require('express-validator');
const { body, param, query } = require('express-validator');
const bcrypt = require('bcryptjs');

// ============================================
// CONFIGURATION
// ============================================

const UsersConfig = {
    profile: {
        maxBioLength: 500,
        allowedAvatarTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxAvatarSize: 5 * 1024 * 1024, // 5MB
        defaultAvatar: 'default-avatar.png'
    },
    preferences: {
        defaults: {
            goal: 'daily',
            level: 'intermediate',
            persona: 'friendly',
            interests: [],
            schedule: 15,
            notifications: {
                email: true,
                push: true,
                streakReminder: true,
                weeklyDigest: true
            },
            privacy: {
                showProfile: true,
                showProgress: true,
                showStreak: true
            }
        }
    },
    search: {
        defaultLimit: 20,
        maxLimit: 100,
        cacheTTL: 300 // seconds
    },
    admin: {
        roles: ['admin', 'moderator', 'support']
    }
};

// ============================================
// DATABASE MODELS (Simulated)
// ============================================

class UserModel {
    constructor() {
        this.users = [];
        this.userStats = new Map();
        this.userPreferences = new Map();
        this.userActivity = new Map();
    }
    
    async create(userData) {
        const user = {
            id: this.users.length + 1,
            ...userData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
            isVerified: false,
            role: 'user',
            stats: {
                totalXP: 0,
                currentLevel: 1,
                currentStreak: 0,
                longestStreak: 0,
                totalSessions: 0,
                totalPracticeTime: 0,
                averageScore: 0,
                achievements: [],
                badges: []
            },
            settings: {
                language: 'en',
                timezone: 'UTC',
                theme: 'light'
            }
        };
        
        this.users.push(user);
        this.userStats.set(user.id, user.stats);
        this.userPreferences.set(user.id, { ...UsersConfig.preferences.defaults });
        
        return user;
    }
    
    async findById(id) {
        return this.users.find(u => u.id === parseInt(id));
    }
    
    async findByEmail(email) {
        return this.users.find(u => u.email === email);
    }
    
    async findAll(filters = {}, options = {}) {
        let results = [...this.users];
        
        // Apply filters
        if (filters.role) {
            results = results.filter(u => u.role === filters.role);
        }
        if (filters.isActive !== undefined) {
            results = results.filter(u => u.isActive === filters.isActive);
        }
        if (filters.isPremium !== undefined) {
            results = results.filter(u => u.isPremium === filters.isPremium);
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            results = results.filter(u => 
                u.name.toLowerCase().includes(searchLower) ||
                u.email.toLowerCase().includes(searchLower)
            );
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
        const limit = Math.min(options.limit || UsersConfig.search.defaultLimit, UsersConfig.search.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            users: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async update(id, updates) {
        const index = this.users.findIndex(u => u.id === parseInt(id));
        if (index === -1) return null;
        
        const allowedUpdates = ['name', 'bio', 'avatar', 'isPremium', 'isActive', 'role', 'settings'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        this.users[index] = {
            ...this.users[index],
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        };
        
        return this.users[index];
    }
    
    async updateStats(userId, statsUpdate) {
        const stats = this.userStats.get(userId) || {};
        const updatedStats = {
            ...stats,
            ...statsUpdate,
            lastUpdated: new Date().toISOString()
        };
        
        this.userStats.set(userId, updatedStats);
        return updatedStats;
    }
    
    async getStats(userId) {
        return this.userStats.get(userId) || {};
    }
    
    async updatePreferences(userId, preferences) {
        const current = this.userPreferences.get(userId) || { ...UsersConfig.preferences.defaults };
        const updated = { ...current, ...preferences };
        this.userPreferences.set(userId, updated);
        return updated;
    }
    
    async getPreferences(userId) {
        return this.userPreferences.get(userId) || { ...UsersConfig.preferences.defaults };
    }
    
    async recordActivity(userId, activityType, metadata = {}) {
        if (!this.userActivity.has(userId)) {
            this.userActivity.set(userId, []);
        }
        
        const activities = this.userActivity.get(userId);
        activities.unshift({
            id: Date.now(),
            type: activityType,
            metadata,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 activities
        if (activities.length > 100) {
            activities.pop();
        }
        
        this.userActivity.set(userId, activities);
        return activities[0];
    }
    
    async getActivity(userId, limit = 20) {
        const activities = this.userActivity.get(userId) || [];
        return activities.slice(0, limit);
    }
    
    async delete(id, softDelete = true) {
        if (softDelete) {
            return this.update(id, { isActive: false });
        } else {
            const index = this.users.findIndex(u => u.id === parseInt(id));
            if (index === -1) return false;
            this.users.splice(index, 1);
            this.userStats.delete(parseInt(id));
            this.userPreferences.delete(parseInt(id));
            this.userActivity.delete(parseInt(id));
            return true;
        }
    }
    
    async getDashboardStats(userId) {
        const user = await this.findById(userId);
        const stats = await this.getStats(userId);
        const preferences = await this.getPreferences(userId);
        const recentActivity = await this.getActivity(userId, 10);
        
        // Calculate level progress
        const nextLevelXP = (stats.currentLevel || 1) * 100;
        const currentLevelXP = ((stats.currentLevel || 1) - 1) * 100;
        const xpInCurrentLevel = (stats.totalXP || 0) - currentLevelXP;
        const progressToNextLevel = Math.min(100, (xpInCurrentLevel / (nextLevelXP - currentLevelXP)) * 100);
        
        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                isPremium: user.isPremium,
                role: user.role
            },
            stats: {
                totalXP: stats.totalXP || 0,
                currentLevel: stats.currentLevel || 1,
                currentStreak: stats.currentStreak || 0,
                longestStreak: stats.longestStreak || 0,
                totalSessions: stats.totalSessions || 0,
                totalPracticeTime: stats.totalPracticeTime || 0,
                averageScore: stats.averageScore || 0,
                achievementsCount: stats.achievements?.length || 0,
                badgesCount: stats.badges?.length || 0,
                levelProgress: progressToNextLevel,
                xpToNextLevel: nextLevelXP - (stats.totalXP || 0)
            },
            preferences,
            recentActivity
        };
    }
}

// ============================================
// USER SERVICE
// ============================================

class UserService {
    constructor(userModel) {
        this.userModel = userModel;
    }
    
    async getUserProfile(userId) {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const stats = await this.userModel.getStats(userId);
        const preferences = await this.userModel.getPreferences(userId);
        
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            avatar: user.avatar,
            isPremium: user.isPremium,
            isVerified: user.isVerified,
            role: user.role,
            createdAt: user.createdAt,
            stats,
            preferences
        };
    }
    
    async updateProfile(userId, updates) {
        const allowedUpdates = ['name', 'bio', 'avatar', 'settings'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        const updatedUser = await this.userModel.update(userId, filteredUpdates);
        if (!updatedUser) {
            throw new Error('User not found');
        }
        
        return updatedUser;
    }
    
    async updatePreferences(userId, preferences) {
        const updated = await this.userModel.updatePreferences(userId, preferences);
        return updated;
    }
    
    async updateStats(userId, statsUpdate) {
        const updated = await this.userModel.updateStats(userId, statsUpdate);
        
        // Check for level up
        const currentLevel = updated.currentLevel || 1;
        const totalXP = updated.totalXP || 0;
        const nextLevelXP = currentLevel * 100;
        
        if (totalXP >= nextLevelXP) {
            const newLevel = Math.floor(totalXP / 100) + 1;
            await this.userModel.updateStats(userId, { currentLevel: newLevel });
            
            // Record level up activity
            await this.userModel.recordActivity(userId, 'level_up', {
                oldLevel: currentLevel,
                newLevel
            });
        }
        
        return updated;
    }
    
    async addXP(userId, amount, source = 'practice') {
        const stats = await this.userModel.getStats(userId);
        const newTotalXP = (stats.totalXP || 0) + amount;
        
        const updated = await this.userModel.updateStats(userId, {
            totalXP: newTotalXP
        });
        
        await this.userModel.recordActivity(userId, 'xp_gain', {
            amount,
            source,
            newTotal: newTotalXP
        });
        
        return { xpGained: amount, newTotalXP };
    }
    
    async updateStreak(userId) {
        const stats = await this.userModel.getStats(userId);
        const today = new Date().toDateString();
        const lastPractice = stats.lastPracticeDate ? new Date(stats.lastPracticeDate).toDateString() : null;
        
        let newStreak = stats.currentStreak || 0;
        
        if (lastPractice === today) {
            // Already updated today
            return { streak: newStreak, increased: false };
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        if (lastPractice === yesterdayStr) {
            newStreak++;
        } else {
            newStreak = 1;
        }
        
        const updated = await this.userModel.updateStats(userId, {
            currentStreak: newStreak,
            longestStreak: Math.max(newStreak, stats.longestStreak || 0),
            lastPracticeDate: new Date().toISOString()
        });
        
        await this.userModel.recordActivity(userId, 'streak_update', {
            newStreak,
            longestStreak: updated.longestStreak
        });
        
        return { streak: newStreak, increased: true, longestStreak: updated.longestStreak };
    }
    
    async recordPracticeSession(userId, sessionData) {
        const { score, duration, transcript } = sessionData;
        
        // Update stats
        const stats = await this.userModel.getStats(userId);
        const totalSessions = (stats.totalSessions || 0) + 1;
        const totalPracticeTime = (stats.totalPracticeTime || 0) + (duration || 0);
        const averageScore = ((stats.averageScore || 0) * (totalSessions - 1) + score) / totalSessions;
        
        await this.userModel.updateStats(userId, {
            totalSessions,
            totalPracticeTime,
            averageScore: Math.round(averageScore)
        });
        
        // Add XP
        const xpGain = Math.floor(score / 10);
        await this.addXP(userId, xpGain, 'practice');
        
        // Update streak
        await this.updateStreak(userId);
        
        // Record activity
        await this.userModel.recordActivity(userId, 'practice_complete', {
            score,
            duration,
            xpGained: xpGain
        });
        
        return {
            success: true,
            xpGained: xpGain,
            totalSessions,
            averageScore: Math.round(averageScore)
        };
    }
    
    async addAchievement(userId, achievementId) {
        const stats = await this.userModel.getStats(userId);
        const achievements = stats.achievements || [];
        
        if (achievements.includes(achievementId)) {
            return { alreadyUnlocked: true };
        }
        
        achievements.push(achievementId);
        await this.userModel.updateStats(userId, { achievements });
        
        // Add XP for achievement
        const achievementXP = 50;
        await this.addXP(userId, achievementXP, 'achievement');
        
        await this.userModel.recordActivity(userId, 'achievement_unlocked', {
            achievementId,
            xpGained: achievementXP
        });
        
        return { unlocked: true, xpGained: achievementXP };
    }
    
    async addBadge(userId, badgeId) {
        const stats = await this.userModel.getStats(userId);
        const badges = stats.badges || [];
        
        if (badges.includes(badgeId)) {
            return { alreadyEarned: true };
        }
        
        badges.push(badgeId);
        await this.userModel.updateStats(userId, { badges });
        
        await this.userModel.recordActivity(userId, 'badge_earned', { badgeId });
        
        return { earned: true };
    }
    
    async searchUsers(query, options = {}) {
        const filters = {
            search: query,
            ...options.filters
        };
        
        const result = await this.userModel.findAll(filters, {
            sortBy: options.sortBy,
            sortOrder: options.sortOrder,
            page: options.page,
            limit: options.limit
        });
        
        return result;
    }
    
    async getLeaderboard(period = 'all', limit = 50) {
        let users = [...this.userModel.users];
        
        // Filter by period
        if (period !== 'all') {
            const periodDays = { week: 7, month: 30, year: 365 };
            const days = periodDays[period] || 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            users = users.filter(u => new Date(u.createdAt) >= cutoffDate);
        }
        
        // Get stats for each user
        const leaderboard = await Promise.all(users.map(async user => {
            const stats = await this.userModel.getStats(user.id);
            return {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                level: stats.currentLevel || 1,
                xp: stats.totalXP || 0,
                streak: stats.currentStreak || 0,
                isPremium: user.isPremium
            };
        }));
        
        // Sort by XP descending
        leaderboard.sort((a, b) => b.xp - a.xp);
        
        return leaderboard.slice(0, limit);
    }
    
    async getUserAnalytics(userId) {
        const stats = await this.userModel.getStats(userId);
        const activity = await this.userModel.getActivity(userId, 50);
        
        // Calculate weekly progress
        const weeklyData = this.calculateWeeklyProgress(activity);
        
        // Calculate category performance
        const categoryPerformance = this.calculateCategoryPerformance(activity);
        
        return {
            overview: {
                totalXP: stats.totalXP || 0,
                currentLevel: stats.currentLevel || 1,
                currentStreak: stats.currentStreak || 0,
                longestStreak: stats.longestStreak || 0,
                totalSessions: stats.totalSessions || 0,
                totalPracticeTime: stats.totalPracticeTime || 0,
                averageScore: stats.averageScore || 0
            },
            achievements: {
                total: stats.achievements?.length || 0,
                list: stats.achievements || []
            },
            badges: {
                total: stats.badges?.length || 0,
                list: stats.badges || []
            },
            weeklyProgress: weeklyData,
            categoryPerformance,
            recentActivity: activity.slice(0, 10)
        };
    }
    
    calculateWeeklyProgress(activity) {
        const weeks = [];
        const now = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            
            const dayActivities = activity.filter(a => 
                new Date(a.timestamp).toDateString() === dateStr && a.type === 'practice_complete'
            );
            
            const totalScore = dayActivities.reduce((sum, a) => sum + (a.metadata.score || 0), 0);
            const avgScore = dayActivities.length > 0 ? totalScore / dayActivities.length : 0;
            
            weeks.push({
                date: dateStr,
                sessions: dayActivities.length,
                averageScore: Math.round(avgScore),
                xpGained: dayActivities.reduce((sum, a) => sum + (a.metadata.xpGained || 0), 0)
            });
        }
        
        return weeks;
    }
    
    calculateCategoryPerformance(activity) {
        const categories = {
            pronunciation: { total: 0, count: 0 },
            fluency: { total: 0, count: 0 },
            grammar: { total: 0, count: 0 },
            vocabulary: { total: 0, count: 0 }
        };
        
        for (const act of activity) {
            if (act.type === 'practice_complete' && act.metadata.scores) {
                const scores = act.metadata.scores;
                for (const [category, score] of Object.entries(scores)) {
                    if (categories[category]) {
                        categories[category].total += score;
                        categories[category].count++;
                    }
                }
            }
        }
        
        const performance = {};
        for (const [category, data] of Object.entries(categories)) {
            performance[category] = data.count > 0 ? Math.round(data.total / data.count) : 0;
        }
        
        return performance;
    }
    
    async getAdminStats() {
        const totalUsers = this.userModel.users.length;
        const activeUsers = this.userModel.users.filter(u => u.isActive).length;
        const premiumUsers = this.userModel.users.filter(u => u.isPremium).length;
        
        let totalXP = 0;
        let totalSessions = 0;
        let totalPracticeTime = 0;
        
        for (const user of this.userModel.users) {
            const stats = await this.userModel.getStats(user.id);
            totalXP += stats.totalXP || 0;
            totalSessions += stats.totalSessions || 0;
            totalPracticeTime += stats.totalPracticeTime || 0;
        }
        
        const userGrowth = await this.calculateUserGrowth();
        
        return {
            totalUsers,
            activeUsers,
            inactiveUsers: totalUsers - activeUsers,
            premiumUsers,
            premiumRate: totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0,
            totalXP,
            totalSessions,
            totalPracticeHours: Math.round(totalPracticeTime / 3600),
            averageXPPerUser: totalUsers > 0 ? Math.round(totalXP / totalUsers) : 0,
            averageSessionsPerUser: totalUsers > 0 ? Math.round(totalSessions / totalUsers) : 0,
            userGrowth
        };
    }
    
    async calculateUserGrowth(days = 30) {
        const growth = [];
        const now = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            
            const usersCreated = this.userModel.users.filter(u => 
                new Date(u.createdAt).toDateString() === dateStr
            ).length;
            
            growth.push({
                date: dateStr,
                newUsers: usersCreated
            });
        }
        
        return growth;
    }
}

// ============================================
// VALIDATION RULES
// ============================================

const UserValidation = {
    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters')
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage('Name can only contain letters and spaces'),
        
        body('bio')
            .optional()
            .trim()
            .isLength({ max: UsersConfig.profile.maxBioLength })
            .withMessage(`Bio cannot exceed ${UsersConfig.profile.maxBioLength} characters`),
        
        body('avatar')
            .optional()
            .isURL()
            .withMessage('Avatar must be a valid URL')
    ],
    
    updatePreferences: [
        body('goal')
            .optional()
            .isIn(['ielts', 'business', 'daily', 'travel', 'academic', 'interview'])
            .withMessage('Invalid goal selected'),
        
        body('level')
            .optional()
            .isIn(['beginner', 'elementary', 'intermediate', 'upper', 'advanced'])
            .withMessage('Invalid level selected'),
        
        body('persona')
            .optional()
            .isIn(['friendly', 'strict', 'fun', 'professional'])
            .withMessage('Invalid persona selected'),
        
        body('interests')
            .optional()
            .isArray()
            .withMessage('Interests must be an array'),
        
        body('schedule')
            .optional()
            .isInt({ min: 1, max: 120 })
            .withMessage('Schedule must be between 1 and 120 minutes'),
        
        body('notifications')
            .optional()
            .isObject()
            .withMessage('Notifications must be an object'),
        
        body('privacy')
            .optional()
            .isObject()
            .withMessage('Privacy must be an object')
    ],
    
    searchUsers: [
        query('q')
            .optional()
            .trim()
            .isLength({ min: 2 })
            .withMessage('Search query must be at least 2 characters'),
        
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: UsersConfig.search.maxLimit })
            .withMessage(`Limit must be between 1 and ${UsersConfig.search.maxLimit}`),
        
        query('sortBy')
            .optional()
            .isIn(['name', 'createdAt', 'totalXP', 'currentLevel'])
            .withMessage('Invalid sort field'),
        
        query('sortOrder')
            .optional()
            .isIn(['asc', 'desc'])
            .withMessage('Sort order must be asc or desc')
    ],
    
    userIdParam: [
        param('id')
            .isInt({ min: 1 })
            .withMessage('Invalid user ID')
    ]
};

// ============================================
// USER ROUTES
// ============================================

function createUserRoutes(userService, authMiddleware) {
    const router = require('express').Router();
    
    // Get current user profile
    router.get('/me', authMiddleware.authenticate, async (req, res) => {
        try {
            const profile = await userService.getUserProfile(req.user.id);
            res.json(profile);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    
    // Update current user profile
    router.put('/me', authMiddleware.authenticate, UserValidation.updateProfile, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const updated = await userService.updateProfile(req.user.id, req.body);
            res.json(updated);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get user preferences
    router.get('/me/preferences', authMiddleware.authenticate, async (req, res) => {
        const preferences = await userService.userModel.getPreferences(req.user.id);
        res.json(preferences);
    });
    
    // Update user preferences
    router.put('/me/preferences', authMiddleware.authenticate, UserValidation.updatePreferences, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const updated = await userService.updatePreferences(req.user.id, req.body);
            res.json(updated);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get user stats
    router.get('/me/stats', authMiddleware.authenticate, async (req, res) => {
        const stats = await userService.userModel.getStats(req.user.id);
        res.json(stats);
    });
    
    // Get user activity
    router.get('/me/activity', authMiddleware.authenticate, async (req, res) => {
        const limit = parseInt(req.query.limit) || 20;
        const activity = await userService.userModel.getActivity(req.user.id, limit);
        res.json(activity);
    });
    
    // Get user analytics
    router.get('/me/analytics', authMiddleware.authenticate, async (req, res) => {
        const analytics = await userService.getUserAnalytics(req.user.id);
        res.json(analytics);
    });
    
    // Get dashboard stats
    router.get('/me/dashboard', authMiddleware.authenticate, async (req, res) => {
        const dashboard = await userService.userModel.getDashboardStats(req.user.id);
        res.json(dashboard);
    });
    
    // Record practice session
    router.post('/me/practice', authMiddleware.authenticate, async (req, res) => {
        const { score, duration, transcript, scores } = req.body;
        
        if (!score) {
            return res.status(400).json({ error: 'Score is required' });
        }
        
        try {
            const result = await userService.recordPracticeSession(req.user.id, {
                score,
                duration,
                transcript,
                scores
            });
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get leaderboard
    router.get('/leaderboard', async (req, res) => {
        const period = req.query.period || 'all';
        const limit = parseInt(req.query.limit) || 50;
        
        const leaderboard = await userService.getLeaderboard(period, limit);
        res.json({ period, leaderboard });
    });
    
    // Search users (admin only)
    router.get('/search', authMiddleware.authenticate, authMiddleware.requireRole('admin'), UserValidation.searchUsers, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { q, page, limit, sortBy, sortOrder } = req.query;
        
        const result = await userService.searchUsers(q, {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || UsersConfig.search.defaultLimit,
            sortBy: sortBy || 'createdAt',
            sortOrder: sortOrder || 'desc',
            filters: req.query
        });
        
        res.json(result);
    });
    
    // Get user by ID (admin only)
    router.get('/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), UserValidation.userIdParam, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const profile = await userService.getUserProfile(req.params.id);
            res.json(profile);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    
    // Update user by ID (admin only)
    router.put('/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), UserValidation.userIdParam, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const updated = await userService.updateProfile(req.params.id, req.body);
            res.json(updated);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Delete user (admin only)
    router.delete('/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), UserValidation.userIdParam, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const softDelete = req.query.soft !== 'false';
        const deleted = await userService.userModel.delete(req.params.id, softDelete);
        
        if (!deleted) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true, softDelete });
    });
    
    // Get admin stats (admin only)
    router.get('/admin/stats', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const stats = await userService.getAdminStats();
        res.json(stats);
    });
    
    return router;
}

// ============================================
// EXPORTS
// ============================================

const userModel = new UserModel();
const userService = new UserService(userModel);
const userRoutes = createUserRoutes(userService, require('./auth').authMiddleware);

module.exports = {
    userModel,
    userService,
    userRoutes,
    UsersConfig,
    UserValidation
};
