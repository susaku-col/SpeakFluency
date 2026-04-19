/* ============================================
   SPEAKFLOW - ANALYTICS MODULE
   Version: 1.0.0
   Handles analytics, reporting, metrics collection, and data visualization
   ============================================ */

const { validationResult } = require('express-validator');
const { body, param, query } = require('express-validator');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const AnalyticsConfig = {
    // Metrics Configuration
    metrics: {
        retention: {
            day1: 0,
            day3: 0,
            day7: 0,
            day14: 0,
            day30: 0
        },
        engagement: {
            dailyActiveUsers: 0,
            weeklyActiveUsers: 0,
            monthlyActiveUsers: 0,
            averageSessionDuration: 0,
            sessionsPerUser: 0
        }
    },
    
    // Reporting
    reports: {
        formats: ['json', 'csv', 'pdf'],
        retentionDays: [1, 3, 7, 14, 30, 60, 90],
        defaultPeriod: 30, // days
        maxPeriod: 365 // days
    },
    
    // Event Tracking
    events: {
        batchSize: 100,
        flushInterval: 30000, // 30 seconds
        retentionDays: 90
    },
    
    // Cache
    cache: {
        ttl: 300, // 5 minutes
        maxSize: 100
    },
    
    // Pagination
    pagination: {
        defaultLimit: 50,
        maxLimit: 500
    }
};

// ============================================
// DATABASE MODELS (Simulated)
// ============================================

class AnalyticsModel {
    constructor() {
        this.events = [];
        this.metrics = new Map();
        this.reports = [];
        this.dailySnapshots = [];
    }
    
    async trackEvent(eventData) {
        const event = {
            id: this.events.length + 1,
            eventId: this.generateEventId(),
            userId: eventData.userId,
            eventType: eventData.eventType,
            category: eventData.category,
            action: eventData.action,
            label: eventData.label,
            value: eventData.value,
            metadata: eventData.metadata || {},
            sessionId: eventData.sessionId,
            timestamp: eventData.timestamp || new Date().toISOString(),
            ipAddress: eventData.ipAddress,
            userAgent: eventData.userAgent,
            url: eventData.url,
            referrer: eventData.referrer
        };
        
        this.events.push(event);
        
        // Update real-time metrics
        await this.updateRealTimeMetrics(event);
        
        return event;
    }
    
    generateEventId() {
        return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    async trackBatchEvents(events) {
        const trackedEvents = [];
        for (const event of events) {
            const tracked = await this.trackEvent(event);
            trackedEvents.push(tracked);
        }
        return trackedEvents;
    }
    
    async getEvents(filters = {}, options = {}) {
        let results = [...this.events];
        
        // Apply filters
        if (filters.userId) {
            results = results.filter(e => e.userId === parseInt(filters.userId));
        }
        if (filters.eventType) {
            results = results.filter(e => e.eventType === filters.eventType);
        }
        if (filters.category) {
            results = results.filter(e => e.category === filters.category);
        }
        if (filters.action) {
            results = results.filter(e => e.action === filters.action);
        }
        if (filters.startDate) {
            results = results.filter(e => new Date(e.timestamp) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            results = results.filter(e => new Date(e.timestamp) <= new Date(filters.endDate));
        }
        
        // Apply sorting
        const sortBy = options.sortBy || 'timestamp';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        // Apply pagination
        const page = options.page || 1;
        const limit = Math.min(options.limit || AnalyticsConfig.pagination.defaultLimit, AnalyticsConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            events: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    async getEventCounts(filters = {}) {
        let results = [...this.events];
        
        if (filters.startDate) {
            results = results.filter(e => new Date(e.timestamp) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            results = results.filter(e => new Date(e.timestamp) <= new Date(filters.endDate));
        }
        
        const counts = {
            total: results.length,
            byEventType: {},
            byCategory: {},
            byAction: {},
            byDate: {}
        };
        
        for (const event of results) {
            // By event type
            if (!counts.byEventType[event.eventType]) {
                counts.byEventType[event.eventType] = 0;
            }
            counts.byEventType[event.eventType]++;
            
            // By category
            if (event.category && !counts.byCategory[event.category]) {
                counts.byCategory[event.category] = 0;
            }
            if (event.category) {
                counts.byCategory[event.category]++;
            }
            
            // By action
            if (event.action && !counts.byAction[event.action]) {
                counts.byAction[event.action] = 0;
            }
            if (event.action) {
                counts.byAction[event.action]++;
            }
            
            // By date
            const date = event.timestamp.substring(0, 10);
            if (!counts.byDate[date]) {
                counts.byDate[date] = 0;
            }
            counts.byDate[date]++;
        }
        
        return counts;
    }
    
    async updateRealTimeMetrics(event) {
        const today = new Date().toISOString().substring(0, 10);
        let todayMetrics = this.metrics.get(today);
        
        if (!todayMetrics) {
            todayMetrics = {
                date: today,
                totalEvents: 0,
                uniqueUsers: new Set(),
                eventCounts: {},
                pageViews: 0,
                sessions: 0
            };
        }
        
        todayMetrics.totalEvents++;
        
        if (event.userId) {
            todayMetrics.uniqueUsers.add(event.userId);
        }
        
        if (!todayMetrics.eventCounts[event.eventType]) {
            todayMetrics.eventCounts[event.eventType] = 0;
        }
        todayMetrics.eventCounts[event.eventType]++;
        
        if (event.eventType === 'page_view') {
            todayMetrics.pageViews++;
        }
        
        if (event.eventType === 'session_start') {
            todayMetrics.sessions++;
        }
        
        this.metrics.set(today, todayMetrics);
        
        // Keep only last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        for (const [date, _] of this.metrics) {
            if (new Date(date) < thirtyDaysAgo) {
                this.metrics.delete(date);
            }
        }
    }
    
    async getRealTimeMetrics() {
        const today = new Date().toISOString().substring(0, 10);
        const todayMetrics = this.metrics.get(today);
        
        if (!todayMetrics) {
            return {
                date: today,
                totalEvents: 0,
                uniqueUsers: 0,
                eventCounts: {},
                pageViews: 0,
                sessions: 0
            };
        }
        
        return {
            date: todayMetrics.date,
            totalEvents: todayMetrics.totalEvents,
            uniqueUsers: todayMetrics.uniqueUsers.size,
            eventCounts: todayMetrics.eventCounts,
            pageViews: todayMetrics.pageViews,
            sessions: todayMetrics.sessions
        };
    }
    
    async getHistoricalMetrics(days = 30) {
        const metrics = [];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().substring(0, 10);
            
            const dayMetrics = this.metrics.get(dateStr);
            metrics.push({
                date: dateStr,
                totalEvents: dayMetrics?.totalEvents || 0,
                uniqueUsers: dayMetrics?.uniqueUsers?.size || 0,
                pageViews: dayMetrics?.pageViews || 0,
                sessions: dayMetrics?.sessions || 0
            });
        }
        
        return metrics;
    }
    
    async createDailySnapshot() {
        const today = new Date().toISOString().substring(0, 10);
        const todayMetrics = await this.getRealTimeMetrics();
        
        const snapshot = {
            date: today,
            metrics: todayMetrics,
            createdAt: new Date().toISOString()
        };
        
        this.dailySnapshots.push(snapshot);
        
        // Keep only last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        this.dailySnapshots = this.dailySnapshots.filter(s => new Date(s.date) >= ninetyDaysAgo);
        
        return snapshot;
    }
    
    async getDailySnapshots(days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        return this.dailySnapshots.filter(s => new Date(s.date) >= startDate);
    }
}

// ============================================
// ANALYTICS SERVICE
// ============================================

class AnalyticsService {
    constructor(analyticsModel) {
        this.analyticsModel = analyticsModel;
    }
    
    async trackEvent(userId, eventData) {
        const event = {
            userId,
            eventType: eventData.eventType,
            category: eventData.category,
            action: eventData.action,
            label: eventData.label,
            value: eventData.value,
            metadata: eventData.metadata,
            sessionId: eventData.sessionId,
            ipAddress: eventData.ipAddress,
            userAgent: eventData.userAgent,
            url: eventData.url,
            referrer: eventData.referrer,
            timestamp: new Date().toISOString()
        };
        
        return await this.analyticsModel.trackEvent(event);
    }
    
    async trackPageView(userId, pageData) {
        return await this.trackEvent(userId, {
            eventType: 'page_view',
            category: 'navigation',
            action: 'view',
            label: pageData.path,
            metadata: {
                title: pageData.title,
                referrer: pageData.referrer,
                loadTime: pageData.loadTime
            },
            url: pageData.url
        });
    }
    
    async trackPracticeSession(userId, sessionData) {
        return await this.trackEvent(userId, {
            eventType: 'practice_session',
            category: 'practice',
            action: 'complete',
            value: sessionData.score,
            metadata: {
                sessionId: sessionData.sessionId,
                duration: sessionData.duration,
                score: sessionData.score,
                scores: sessionData.scores
            }
        });
    }
    
    async trackAchievement(userId, achievementData) {
        return await this.trackEvent(userId, {
            eventType: 'achievement_unlocked',
            category: 'gamification',
            action: 'unlock',
            label: achievementData.achievementId,
            metadata: {
                name: achievementData.name,
                xpReward: achievementData.xpReward
            }
        });
    }
    
    async trackPayment(userId, paymentData) {
        return await this.trackEvent(userId, {
            eventType: 'payment',
            category: 'conversion',
            action: paymentData.status,
            value: paymentData.amount,
            metadata: {
                planId: paymentData.planId,
                transactionId: paymentData.transactionId
            }
        });
    }
    
    async getUserAnalytics(userId, period = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - period);
        
        const events = await this.analyticsModel.getEvents({
            userId,
            startDate: startDate.toISOString()
        });
        
        // Calculate user stats
        const practiceSessions = events.events.filter(e => e.eventType === 'practice_session');
        const averageScore = practiceSessions.length > 0
            ? practiceSessions.reduce((sum, e) => sum + (e.value || 0), 0) / practiceSessions.length
            : 0;
        
        const totalPracticeTime = practiceSessions.reduce((sum, e) => sum + (e.metadata?.duration || 0), 0);
        
        const achievements = events.events.filter(e => e.eventType === 'achievement_unlocked');
        
        const pageViews = events.events.filter(e => e.eventType === 'page_view');
        
        // Calculate daily activity
        const dailyActivity = {};
        for (const event of events.events) {
            const date = event.timestamp.substring(0, 10);
            if (!dailyActivity[date]) {
                dailyActivity[date] = { events: 0, practice: false };
            }
            dailyActivity[date].events++;
            if (event.eventType === 'practice_session') {
                dailyActivity[date].practice = true;
            }
        }
        
        const streak = this.calculateStreak(dailyActivity);
        
        return {
            userId,
            period,
            summary: {
                totalEvents: events.total,
                practiceSessions: practiceSessions.length,
                achievementsUnlocked: achievements.length,
                pageViews: pageViews.length,
                averageScore: Math.round(averageScore),
                totalPracticeTime,
                currentStreak: streak.current,
                longestStreak: streak.longest
            },
            practiceHistory: practiceSessions.map(s => ({
                date: s.timestamp,
                score: s.value,
                duration: s.metadata?.duration
            })),
            achievements: achievements.map(a => ({
                id: a.label,
                name: a.metadata?.name,
                date: a.timestamp
            })),
            dailyActivity
        };
    }
    
    calculateStreak(dailyActivity) {
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        
        const dates = Object.keys(dailyActivity).sort();
        
        for (let i = 0; i < dates.length; i++) {
            if (dailyActivity[dates[i]].practice) {
                tempStreak++;
                if (tempStreak > longestStreak) {
                    longestStreak = tempStreak;
                }
            } else {
                tempStreak = 0;
            }
        }
        
        // Check current streak (from today backwards)
        const today = new Date().toISOString().substring(0, 10);
        let checkDate = new Date();
        currentStreak = 0;
        
        while (dailyActivity[checkDate.toISOString().substring(0, 10)]?.practice) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        
        return { current: currentStreak, longest: longestStreak };
    }
    
    async getRetentionMetrics(cohortDate = null) {
        const users = await this.getActiveUsers();
        const retention = {
            day1: 0,
            day3: 0,
            day7: 0,
            day14: 0,
            day30: 0,
            day60: 0,
            day90: 0
        };
        
        for (const user of users) {
            const userRetention = await this.calculateUserRetention(user.id, cohortDate);
            for (const [day, value] of Object.entries(userRetention)) {
                retention[day] += value;
            }
        }
        
        const userCount = users.length;
        if (userCount > 0) {
            for (const day in retention) {
                retention[day] = (retention[day] / userCount) * 100;
            }
        }
        
        return retention;
    }
    
    async calculateUserRetention(userId, cohortDate = null) {
        const userEvents = await this.analyticsModel.getEvents({ userId });
        const firstSession = userEvents.events.find(e => e.eventType === 'practice_session');
        
        if (!firstSession) {
            return {
                day1: 0, day3: 0, day7: 0, day14: 0, day30: 0, day60: 0, day90: 0
            };
        }
        
        const startDate = new Date(firstSession.timestamp);
        const retention = {
            day1: 0, day3: 0, day7: 0, day14: 0, day30: 0, day60: 0, day90: 0
        };
        
        for (const event of userEvents.events) {
            const eventDate = new Date(event.timestamp);
            const daysDiff = Math.floor((eventDate - startDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === 1) retention.day1 = 1;
            if (daysDiff <= 3) retention.day3 = 1;
            if (daysDiff <= 7) retention.day7 = 1;
            if (daysDiff <= 14) retention.day14 = 1;
            if (daysDiff <= 30) retention.day30 = 1;
            if (daysDiff <= 60) retention.day60 = 1;
            if (daysDiff <= 90) retention.day90 = 1;
        }
        
        return retention;
    }
    
    async getActiveUsers() {
        // In production, fetch from user service
        // For demo, return simulated data
        return [
            { id: 1, name: 'User 1', createdAt: new Date() },
            { id: 2, name: 'User 2', createdAt: new Date() }
        ];
    }
    
    async getEngagementMetrics(period = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - period);
        
        const events = await this.analyticsModel.getEvents({
            startDate: startDate.toISOString()
        });
        
        const uniqueUsers = new Set(events.events.map(e => e.userId));
        const practiceSessions = events.events.filter(e => e.eventType === 'practice_session');
        
        const averageSessionDuration = practiceSessions.length > 0
            ? practiceSessions.reduce((sum, e) => sum + (e.metadata?.duration || 0), 0) / practiceSessions.length
            : 0;
        
        // Calculate DAU, WAU, MAU
        const dailyUsers = new Map();
        const weeklyUsers = new Set();
        const monthlyUsers = new Set();
        
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        
        for (const event of events.events) {
            const eventDate = new Date(event.timestamp).toISOString().substring(0, 10);
            dailyUsers.set(eventDate, (dailyUsers.get(eventDate) || 0) + 1);
            
            if (new Date(event.timestamp) >= weekAgo) {
                weeklyUsers.add(event.userId);
            }
            if (new Date(event.timestamp) >= monthAgo) {
                monthlyUsers.add(event.userId);
            }
        }
        
        const dailyActiveUsers = dailyUsers.size > 0 
            ? Array.from(dailyUsers.values()).reduce((a, b) => a + b, 0) / dailyUsers.size
            : 0;
        
        return {
            period,
            dailyActiveUsers: Math.round(dailyActiveUsers),
            weeklyActiveUsers: weeklyUsers.size,
            monthlyActiveUsers: monthlyUsers.size,
            averageSessionDuration: Math.round(averageSessionDuration),
            sessionsPerUser: uniqueUsers.size > 0 ? practiceSessions.length / uniqueUsers.size : 0,
            totalSessions: practiceSessions.length,
            uniqueUsers: uniqueUsers.size
        };
    }
    
    async getConversionFunnel() {
        const events = await this.analyticsModel.getEvents();
        
        const funnel = {
            signup: 0,
            onboarding_complete: 0,
            first_practice: 0,
            practice_3_sessions: 0,
            practice_7_sessions: 0,
            premium_upgrade: 0
        };
        
        const userProgress = new Map();
        
        for (const event of events.events) {
            if (!userProgress.has(event.userId)) {
                userProgress.set(event.userId, {
                    signup: false,
                    onboarding: false,
                    practices: 0,
                    premium: false
                });
            }
            
            const progress = userProgress.get(event.userId);
            
            if (event.eventType === 'user_registered') {
                progress.signup = true;
                funnel.signup++;
            }
            
            if (event.eventType === 'onboarding_complete') {
                progress.onboarding = true;
                funnel.onboarding_complete++;
            }
            
            if (event.eventType === 'practice_session') {
                progress.practices++;
                if (progress.practices === 1) funnel.first_practice++;
                if (progress.practices === 3) funnel.practice_3_sessions++;
                if (progress.practices === 7) funnel.practice_7_sessions++;
            }
            
            if (event.eventType === 'premium_upgrade') {
                progress.premium = true;
                funnel.premium_upgrade++;
            }
            
            userProgress.set(event.userId, progress);
        }
        
        // Calculate conversion rates
        const conversionRates = {
            signup_to_onboarding: funnel.signup > 0 ? (funnel.onboarding_complete / funnel.signup) * 100 : 0,
            onboarding_to_first_practice: funnel.onboarding_complete > 0 ? (funnel.first_practice / funnel.onboarding_complete) * 100 : 0,
            first_to_three_practices: funnel.first_practice > 0 ? (funnel.practice_3_sessions / funnel.first_practice) * 100 : 0,
            three_to_seven_practices: funnel.practice_3_sessions > 0 ? (funnel.practice_7_sessions / funnel.practice_3_sessions) * 100 : 0,
            seven_to_premium: funnel.practice_7_sessions > 0 ? (funnel.premium_upgrade / funnel.practice_7_sessions) * 100 : 0
        };
        
        return {
            counts: funnel,
            conversionRates,
            totalUsers: funnel.signup
        };
    }
    
    async generateReport(reportType, options = {}) {
        const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = options.endDate || new Date();
        
        let report = {
            reportType,
            generatedAt: new Date().toISOString(),
            period: { startDate, endDate },
            data: {}
        };
        
        switch (reportType) {
            case 'daily':
                report.data = await this.analyticsModel.getHistoricalMetrics(30);
                break;
            case 'retention':
                report.data = await this.getRetentionMetrics();
                break;
            case 'engagement':
                report.data = await this.getEngagementMetrics(30);
                break;
            case 'funnel':
                report.data = await this.getConversionFunnel();
                break;
            case 'revenue':
                report.data = await this.getRevenueReport(startDate, endDate);
                break;
            default:
                throw new Error('Invalid report type');
        }
        
        // Store report
        this.analyticsModel.reports.push({
            id: this.analyticsModel.reports.length + 1,
            ...report,
            createdAt: new Date().toISOString()
        });
        
        return report;
    }
    
    async getRevenueReport(startDate, endDate) {
        const payments = await this.getPaymentsInPeriod(startDate, endDate);
        
        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const subscriptionRevenue = payments.filter(p => p.type === 'subscription').reduce((sum, p) => sum + p.amount, 0);
        const oneTimeRevenue = payments.filter(p => p.type === 'one_time').reduce((sum, p) => sum + p.amount, 0);
        
        const revenueByPlan = {};
        for (const payment of payments) {
            if (!revenueByPlan[payment.planId]) {
                revenueByPlan[payment.planId] = 0;
            }
            revenueByPlan[payment.planId] += payment.amount;
        }
        
        // Monthly breakdown
        const monthlyBreakdown = {};
        for (const payment of payments) {
            const month = payment.date.substring(0, 7);
            if (!monthlyBreakdown[month]) {
                monthlyBreakdown[month] = 0;
            }
            monthlyBreakdown[month] += payment.amount;
        }
        
        return {
            totalRevenue,
            subscriptionRevenue,
            oneTimeRevenue,
            revenueByPlan,
            monthlyBreakdown,
            totalTransactions: payments.length,
            averageTransactionValue: payments.length > 0 ? totalRevenue / payments.length : 0
        };
    }
    
    async getPaymentsInPeriod(startDate, endDate) {
        // In production, fetch from payment service
        // For demo, return simulated data
        return [];
    }
    
    async exportReport(report, format = 'json') {
        if (format === 'json') {
            return JSON.stringify(report, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(report);
        } else {
            return report;
        }
    }
    
    convertToCSV(report) {
        // Convert report data to CSV format
        const rows = [['Metric', 'Value']];
        
        if (report.reportType === 'engagement') {
            for (const [key, value] of Object.entries(report.data)) {
                rows.push([key, value]);
            }
        } else if (report.reportType === 'retention') {
            for (const [day, rate] of Object.entries(report.data)) {
                rows.push([`Retention ${day}`, `${rate.toFixed(2)}%`]);
            }
        }
        
        return rows.map(row => row.join(',')).join('\n');
    }
}

// ============================================
// VALIDATION RULES
// ============================================

const AnalyticsValidation = {
    trackEvent: [
        body('eventType')
            .notEmpty().withMessage('Event type is required')
            .isString().withMessage('Event type must be a string'),
        
        body('category')
            .optional()
            .isString().withMessage('Category must be a string'),
        
        body('action')
            .optional()
            .isString().withMessage('Action must be a string'),
        
        body('value')
            .optional()
            .isNumeric().withMessage('Value must be a number')
    ],
    
    getEvents: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: AnalyticsConfig.pagination.maxLimit })
            .withMessage(`Limit must be between 1 and ${AnalyticsConfig.pagination.maxLimit}`),
        
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid start date'),
        
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('Invalid end date'),
        
        query('eventType')
            .optional()
            .isString()
            .withMessage('Event type must be a string')
    ],
    
    generateReport: [
        body('reportType')
            .notEmpty().withMessage('Report type is required')
            .isIn(['daily', 'retention', 'engagement', 'funnel', 'revenue'])
            .withMessage('Invalid report type'),
        
        body('format')
            .optional()
            .isIn(AnalyticsConfig.reports.formats)
            .withMessage(`Format must be one of: ${AnalyticsConfig.reports.formats.join(', ')}`)
    ]
};

// ============================================
// ANALYTICS ROUTES
// ============================================

function createAnalyticsRoutes(analyticsService, authMiddleware) {
    const router = require('express').Router();
    
    // Track event
    router.post('/track', authMiddleware.authenticate, AnalyticsValidation.trackEvent, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const event = await analyticsService.trackEvent(req.user.id, req.body);
            res.status(201).json(event);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Track page view
    router.post('/track/page-view', authMiddleware.authenticate, async (req, res) => {
        try {
            const event = await analyticsService.trackPageView(req.user.id, req.body);
            res.status(201).json(event);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Track practice session
    router.post('/track/practice', authMiddleware.authenticate, async (req, res) => {
        try {
            const event = await analyticsService.trackPracticeSession(req.user.id, req.body);
            res.status(201).json(event);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get user analytics
    router.get('/user', authMiddleware.authenticate, async (req, res) => {
        const period = parseInt(req.query.period) || 30;
        
        try {
            const analytics = await analyticsService.getUserAnalytics(req.user.id, period);
            res.json(analytics);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get events
    router.get('/events', authMiddleware.authenticate, authMiddleware.requireRole('admin'), AnalyticsValidation.getEvents, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const filters = {
            userId: req.query.userId,
            eventType: req.query.eventType,
            category: req.query.category,
            action: req.query.action,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || AnalyticsConfig.pagination.defaultLimit,
            sortBy: req.query.sortBy || 'timestamp',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const events = await analyticsService.analyticsModel.getEvents(filters, options);
        res.json(events);
    });
    
    // Get event counts
    router.get('/events/counts', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const { startDate, endDate } = req.query;
        
        const counts = await analyticsService.analyticsModel.getEventCounts({ startDate, endDate });
        res.json(counts);
    });
    
    // Get real-time metrics
    router.get('/realtime', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const metrics = await analyticsService.analyticsModel.getRealTimeMetrics();
        res.json(metrics);
    });
    
    // Get retention metrics
    router.get('/retention', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const retention = await analyticsService.getRetentionMetrics();
        res.json(retention);
    });
    
    // Get engagement metrics
    router.get('/engagement', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const period = parseInt(req.query.period) || 30;
        const metrics = await analyticsService.getEngagementMetrics(period);
        res.json(metrics);
    });
    
    // Get conversion funnel
    router.get('/funnel', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const funnel = await analyticsService.getConversionFunnel();
        res.json(funnel);
    });
    
    // Generate report
    router.post('/reports/generate', authMiddleware.authenticate, authMiddleware.requireRole('admin'), AnalyticsValidation.generateReport, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const report = await analyticsService.generateReport(req.body.reportType, req.body.options);
            const format = req.body.format || 'json';
            const exportData = await analyticsService.exportReport(report, format);
            
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.csv`);
                res.send(exportData);
            } else {
                res.json(report);
            }
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get reports list
    router.get('/reports', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const reports = analyticsService.analyticsModel.reports;
        res.json(reports);
    });
    
    // Get report by ID
    router.get('/reports/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const report = analyticsService.analyticsModel.reports.find(r => r.id === parseInt(req.params.id));
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json(report);
    });
    
    // Create daily snapshot (cron job)
    router.post('/snapshots/daily', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const snapshot = await analyticsService.analyticsModel.createDailySnapshot();
        res.json(snapshot);
    });
    
    // Get daily snapshots
    router.get('/snapshots', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const days = parseInt(req.query.days) || 30;
        const snapshots = await analyticsService.analyticsModel.getDailySnapshots(days);
        res.json(snapshots);
    });
    
    return router;
}

// ============================================
// EXPORTS
// ============================================

const analyticsModel = new AnalyticsModel();
const analyticsService = new AnalyticsService(analyticsModel);
const analyticsRoutes = createAnalyticsRoutes(analyticsService, require('./auth').authMiddleware);

module.exports = {
    analyticsModel,
    analyticsService,
    analyticsRoutes,
    AnalyticsConfig,
    AnalyticsValidation
};
