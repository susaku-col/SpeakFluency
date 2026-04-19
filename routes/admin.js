/* ============================================
   SPEAKFLOW - ADMIN MODULE
   Version: 1.0.0
   Handles admin dashboard, user management, system monitoring, and analytics
   ============================================ */

const { validationResult } = require('express-validator');
const { body, param, query } = require('express-validator');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================

const AdminConfig = {
    // Admin Roles
    roles: {
        super_admin: { level: 100, permissions: ['all'] },
        admin: { level: 80, permissions: ['users', 'content', 'analytics', 'settings'] },
        moderator: { level: 50, permissions: ['users.view', 'content.moderate', 'tickets'] },
        support: { level: 30, permissions: ['users.view', 'tickets'] }
    },
    
    // System Monitoring
    monitoring: {
        checkInterval: 60000, // 1 minute
        alertThresholds: {
            cpu: 80, // percentage
            memory: 85, // percentage
            disk: 90, // percentage
            responseTime: 2000, // milliseconds
            errorRate: 5 // percentage
        },
        retentionDays: 30
    },
    
    // User Management
    userManagement: {
        defaultRole: 'user',
        maxUsersPerPage: 50,
        allowedSortFields: ['id', 'name', 'email', 'createdAt', 'lastLoginAt', 'xp', 'level']
    },
    
    // Content Management
    contentManagement: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
    },
    
    // Audit Log
    auditLog: {
        retentionDays: 90,
        actions: [
            'user.create', 'user.update', 'user.delete', 'user.suspend',
            'content.create', 'content.update', 'content.delete',
            'settings.update', 'role.assign', 'permission.grant'
        ]
    },
    
    // Pagination
    pagination: {
        defaultLimit: 20,
        maxLimit: 100
    }
};

// ============================================
// DATABASE MODELS (Simulated)
// ============================================

class AdminModel {
    constructor() {
        this.auditLogs = [];
        this.systemMetrics = [];
        this.alerts = [];
        this.settings = {};
        this.roles = AdminConfig.roles;
    }
    
    // Audit Log
    async logAction(actionData) {
        const log = {
            id: this.auditLogs.length + 1,
            logId: this.generateLogId(),
            userId: actionData.userId,
            userEmail: actionData.userEmail,
            userName: actionData.userName,
            action: actionData.action,
            resourceType: actionData.resourceType,
            resourceId: actionData.resourceId,
            changes: actionData.changes || null,
            ipAddress: actionData.ipAddress,
            userAgent: actionData.userAgent,
            metadata: actionData.metadata || {},
            createdAt: new Date().toISOString()
        };
        
        this.auditLogs.push(log);
        
        // Clean old logs
        this.cleanOldLogs();
        
        return log;
    }
    
    generateLogId() {
        return `log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    cleanOldLogs() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - AdminConfig.auditLog.retentionDays);
        
        this.auditLogs = this.auditLogs.filter(log => 
            new Date(log.createdAt) > cutoffDate
        );
    }
    
    async getAuditLogs(filters = {}, options = {}) {
        let results = [...this.auditLogs];
        
        if (filters.userId) {
            results = results.filter(l => l.userId === parseInt(filters.userId));
        }
        if (filters.action) {
            results = results.filter(l => l.action === filters.action);
        }
        if (filters.resourceType) {
            results = results.filter(l => l.resourceType === filters.resourceType);
        }
        if (filters.startDate) {
            results = results.filter(l => new Date(l.createdAt) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            results = results.filter(l => new Date(l.createdAt) <= new Date(filters.endDate));
        }
        
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        const page = options.page || 1;
        const limit = Math.min(options.limit || AdminConfig.pagination.defaultLimit, AdminConfig.pagination.maxLimit);
        const start = (page - 1) * limit;
        const end = start + limit;
        
        return {
            logs: results.slice(start, end),
            total: results.length,
            page,
            limit,
            totalPages: Math.ceil(results.length / limit)
        };
    }
    
    // System Metrics
    async recordSystemMetrics(metrics) {
        const metric = {
            id: this.systemMetrics.length + 1,
            timestamp: new Date().toISOString(),
            cpu: metrics.cpu,
            memory: metrics.memory,
            disk: metrics.disk,
            uptime: metrics.uptime,
            activeUsers: metrics.activeUsers,
            responseTime: metrics.responseTime,
            errorRate: metrics.errorRate,
            requestCount: metrics.requestCount
        };
        
        this.systemMetrics.push(metric);
        
        // Clean old metrics
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - AdminConfig.monitoring.retentionDays);
        this.systemMetrics = this.systemMetrics.filter(m => 
            new Date(m.timestamp) > cutoffDate
        );
        
        // Check thresholds and create alerts
        await this.checkThresholds(metric);
        
        return metric;
    }
    
    async checkThresholds(metric) {
        const alerts = [];
        
        if (metric.cpu > AdminConfig.monitoring.alertThresholds.cpu) {
            alerts.push({
                type: 'cpu',
                value: metric.cpu,
                threshold: AdminConfig.monitoring.alertThresholds.cpu,
                severity: metric.cpu > AdminConfig.monitoring.alertThresholds.cpu + 10 ? 'critical' : 'warning'
            });
        }
        
        if (metric.memory > AdminConfig.monitoring.alertThresholds.memory) {
            alerts.push({
                type: 'memory',
                value: metric.memory,
                threshold: AdminConfig.monitoring.alertThresholds.memory,
                severity: metric.memory > AdminConfig.monitoring.alertThresholds.memory + 10 ? 'critical' : 'warning'
            });
        }
        
        if (metric.responseTime > AdminConfig.monitoring.alertThresholds.responseTime) {
            alerts.push({
                type: 'response_time',
                value: metric.responseTime,
                threshold: AdminConfig.monitoring.alertThresholds.responseTime,
                severity: 'warning'
            });
        }
        
        for (const alert of alerts) {
            await this.createAlert(alert);
        }
    }
    
    async createAlert(alertData) {
        const alert = {
            id: this.alerts.length + 1,
            alertId: this.generateAlertId(),
            type: alertData.type,
            value: alertData.value,
            threshold: alertData.threshold,
            severity: alertData.severity,
            message: `${alertData.type} usage is at ${alertData.value}% (threshold: ${alertData.threshold}%)`,
            status: 'active',
            acknowledged: false,
            acknowledgedBy: null,
            acknowledgedAt: null,
            createdAt: new Date().toISOString()
        };
        
        this.alerts.push(alert);
        return alert;
    }
    
    generateAlertId() {
        return `alert_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async getSystemMetrics(period = 24) {
        const hours = period * 60 * 60 * 1000;
        const cutoffTime = Date.now() - hours;
        
        const metrics = this.systemMetrics.filter(m => 
            new Date(m.timestamp).getTime() > cutoffTime
        );
        
        const averages = {
            cpu: 0,
            memory: 0,
            disk: 0,
            responseTime: 0,
            errorRate: 0
        };
        
        if (metrics.length > 0) {
            averages.cpu = metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length;
            averages.memory = metrics.reduce((sum, m) => sum + m.memory, 0) / metrics.length;
            averages.disk = metrics.reduce((sum, m) => sum + m.disk, 0) / metrics.length;
            averages.responseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
            averages.errorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length;
        }
        
        return {
            current: metrics[metrics.length - 1] || null,
            averages,
            history: metrics.slice(-24) // Last 24 data points
        };
    }
    
    async getActiveAlerts() {
        return this.alerts.filter(a => a.status === 'active');
    }
    
    async acknowledgeAlert(alertId, userId) {
        const alert = this.alerts.find(a => a.id === parseInt(alertId));
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedBy = userId;
            alert.acknowledgedAt = new Date().toISOString();
        }
        return alert;
    }
    
    async resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === parseInt(alertId));
        if (alert) {
            alert.status = 'resolved';
            alert.resolvedAt = new Date().toISOString();
        }
        return alert;
    }
    
    // Settings
    async getSetting(key) {
        return this.settings[key];
    }
    
    async setSetting(key, value, userId) {
        const oldValue = this.settings[key];
        this.settings[key] = value;
        
        await this.logAction({
            userId,
            action: 'settings.update',
            resourceType: 'setting',
            resourceId: key,
            changes: { old: oldValue, new: value }
        });
        
        return this.settings[key];
    }
    
    async getAllSettings() {
        return this.settings;
    }
}

// ============================================
// ADMIN SERVICE
// ============================================

class AdminService {
    constructor(adminModel) {
        this.adminModel = adminModel;
        this.startMonitoring();
    }
    
    startMonitoring() {
        setInterval(() => {
            this.collectSystemMetrics();
        }, AdminConfig.monitoring.checkInterval);
    }
    
    async collectSystemMetrics() {
        const metrics = {
            cpu: await this.getCPUUsage(),
            memory: await this.getMemoryUsage(),
            disk: await this.getDiskUsage(),
            uptime: process.uptime(),
            activeUsers: await this.getActiveUsersCount(),
            responseTime: await this.getAverageResponseTime(),
            errorRate: await this.getErrorRate(),
            requestCount: await this.getRequestCount()
        };
        
        await this.adminModel.recordSystemMetrics(metrics);
    }
    
    async getCPUUsage() {
        // In production, use system monitoring library
        // For demo, return simulated value
        return Math.random() * 100;
    }
    
    async getMemoryUsage() {
        const used = process.memoryUsage();
        const total = 16 * 1024 * 1024 * 1024; // 16GB
        return (used.heapUsed / total) * 100;
    }
    
    async getDiskUsage() {
        // In production, use disk usage library
        return Math.random() * 100;
    }
    
    async getActiveUsersCount() {
        // In production, query database
        return Math.floor(Math.random() * 1000);
    }
    
    async getAverageResponseTime() {
        // In production, calculate from logs
        return 100 + Math.random() * 500;
    }
    
    async getErrorRate() {
        // In production, calculate from logs
        return Math.random() * 10;
    }
    
    async getRequestCount() {
        // In production, count from logs
        return Math.floor(Math.random() * 10000);
    }
    
    // Dashboard Stats
    async getDashboardStats() {
        const metrics = await this.adminModel.getSystemMetrics(24);
        const activeAlerts = await this.adminModel.getActiveAlerts();
        
        // In production, get from database
        const stats = {
            totalUsers: 12450,
            newUsersToday: 124,
            activeUsers: 2340,
            premiumUsers: 1250,
            totalRevenue: 12450.00,
            revenueToday: 450.00,
            totalSessions: 45670,
            sessionsToday: 234,
            averageScore: 72.5,
            openTickets: 12,
            responseTime: 1.2,
            uptime: 99.95
        };
        
        return {
            stats,
            system: metrics,
            alerts: activeAlerts
        };
    }
    
    // User Management
    async getAllUsers(filters = {}, options = {}) {
        // In production, fetch from user service
        const users = [];
        for (let i = 1; i <= 100; i++) {
            users.push({
                id: i,
                name: `User ${i}`,
                email: `user${i}@example.com`,
                role: i === 1 ? 'admin' : 'user',
                isPremium: i % 10 === 0,
                isActive: true,
                xp: i * 100,
                level: Math.floor(i / 10) + 1,
                streak: i % 30,
                createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
                lastLoginAt: new Date(Date.now() - (i % 7) * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        let results = [...users];
        
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            results = results.filter(u => 
                u.name.toLowerCase().includes(searchLower) ||
                u.email.toLowerCase().includes(searchLower)
            );
        }
        
        if (filters.role) {
            results = results.filter(u => u.role === filters.role);
        }
        
        if (filters.isPremium !== undefined) {
            results = results.filter(u => u.isPremium === (filters.isPremium === 'true'));
        }
        
        if (filters.isActive !== undefined) {
            results = results.filter(u => u.isActive === (filters.isActive === 'true'));
        }
        
        const sortBy = options.sortBy || 'id';
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return -sortOrder;
            if (a[sortBy] > b[sortBy]) return sortOrder;
            return 0;
        });
        
        const page = options.page || 1;
        const limit = Math.min(options.limit || AdminConfig.userManagement.maxUsersPerPage, 100);
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
    
    async getUserById(userId) {
        // In production, fetch from user service
        return {
            id: userId,
            name: `User ${userId}`,
            email: `user${userId}@example.com`,
            role: 'user',
            isPremium: userId % 10 === 0,
            isActive: true,
            xp: userId * 100,
            level: Math.floor(userId / 10) + 1,
            streak: userId % 30,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            preferences: {
                goal: 'daily',
                level: 'intermediate',
                persona: 'friendly',
                interests: ['technology', 'travel']
            },
            stats: {
                totalSessions: userId * 5,
                totalPracticeTime: userId * 60,
                averageScore: 70 + (userId % 30)
            }
        };
    }
    
    async updateUser(userId, updates, adminUserId) {
        // In production, update in database
        const user = await this.getUserById(userId);
        
        await this.adminModel.logAction({
            userId: adminUserId,
            action: 'user.update',
            resourceType: 'user',
            resourceId: userId,
            changes: updates
        });
        
        return { ...user, ...updates };
    }
    
    async suspendUser(userId, reason, adminUserId) {
        await this.adminModel.logAction({
            userId: adminUserId,
            action: 'user.suspend',
            resourceType: 'user',
            resourceId: userId,
            metadata: { reason }
        });
        
        return { success: true, userId, suspended: true };
    }
    
    async activateUser(userId, adminUserId) {
        await this.adminModel.logAction({
            userId: adminUserId,
            action: 'user.activate',
            resourceType: 'user',
            resourceId: userId
        });
        
        return { success: true, userId, activated: true };
    }
    
    async deleteUser(userId, adminUserId) {
        await this.adminModel.logAction({
            userId: adminUserId,
            action: 'user.delete',
            resourceType: 'user',
            resourceId: userId
        });
        
        return { success: true, userId, deleted: true };
    }
    
    async assignRole(userId, role, adminUserId) {
        if (!AdminConfig.roles[role]) {
            throw new Error('Invalid role');
        }
        
        await this.adminModel.logAction({
            userId: adminUserId,
            action: 'role.assign',
            resourceType: 'user',
            resourceId: userId,
            changes: { role }
        });
        
        return { success: true, userId, role };
    }
    
    // System Settings
    async getSettings() {
        return await this.adminModel.getAllSettings();
    }
    
    async updateSetting(key, value, adminUserId) {
        return await this.adminModel.setSetting(key, value, adminUserId);
    }
    
    // Audit Logs
    async getAuditLogs(filters = {}, options = {}) {
        return await this.adminModel.getAuditLogs(filters, options);
    }
    
    // System Health
    async getSystemHealth() {
        const metrics = await this.adminModel.getSystemMetrics();
        const activeAlerts = await this.adminModel.getActiveAlerts();
        
        const health = {
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            metrics: metrics.current,
            alerts: activeAlerts,
            services: {
                database: await this.checkDatabaseHealth(),
                redis: await this.checkRedisHealth(),
                api: await this.checkAPIHealth()
            }
        };
        
        // Determine overall status
        if (activeAlerts.some(a => a.severity === 'critical')) {
            health.status = 'critical';
        } else if (activeAlerts.length > 0) {
            health.status = 'warning';
        }
        
        return health;
    }
    
    async checkDatabaseHealth() {
        // In production, check database connection
        return { status: 'healthy', latency: 5 };
    }
    
    async checkRedisHealth() {
        // In production, check Redis connection
        return { status: 'healthy', latency: 2 };
    }
    
    async checkAPIHealth() {
        return { status: 'healthy', latency: 10 };
    }
    
    // Analytics
    async getUserAnalytics() {
        // In production, aggregate from database
        return {
            totalUsers: 12450,
            userGrowth: this.generateGrowthData(30),
            userRetention: {
                day1: 65,
                day7: 45,
                day30: 30
            },
            userSegments: {
                free: 90,
                premium: 10
            },
            userActivity: this.generateActivityData()
        };
    }
    
    generateGrowthData(days) {
        const data = [];
        for (let i = days; i >= 0; i--) {
            data.push({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                users: Math.floor(10000 + Math.random() * 5000)
            });
        }
        return data;
    }
    
    generateActivityData() {
        const hours = [];
        for (let i = 0; i < 24; i++) {
            hours.push({
                hour: i,
                activeUsers: Math.floor(Math.random() * 500)
            });
        }
        return hours;
    }
    
    async getRevenueAnalytics() {
        return {
            daily: this.generateRevenueData(30),
            monthly: this.generateRevenueData(12, 'month'),
            byPlan: {
                monthly: 4500,
                yearly: 8000,
                lifetime: 1500
            },
            averageRevenuePerUser: 45.50,
            lifetimeValue: 120.00,
            churnRate: 5.2
        };
    }
    
    generateRevenueData(periods, type = 'day') {
        const data = [];
        for (let i = periods; i >= 0; i--) {
            let date;
            if (type === 'month') {
                date = new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0].slice(0, 7);
            } else {
                date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            data.push({
                period: date,
                revenue: Math.floor(1000 + Math.random() * 5000)
            });
        }
        return data;
    }
}

// ============================================
// VALIDATION RULES
// ============================================

const AdminValidation = {
    getUsers: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: AdminConfig.userManagement.maxUsersPerPage })
            .withMessage(`Limit must be between 1 and ${AdminConfig.userManagement.maxUsersPerPage}`),
        
        query('search')
            .optional()
            .isString()
            .withMessage('Search query must be a string'),
        
        query('role')
            .optional()
            .isIn(['user', 'admin', 'moderator', 'support'])
            .withMessage('Invalid role'),
        
        query('sortBy')
            .optional()
            .isIn(AdminConfig.userManagement.allowedSortFields)
            .withMessage('Invalid sort field')
    ],
    
    updateUser: [
        body('name')
            .optional()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        
        body('role')
            .optional()
            .isIn(['user', 'admin', 'moderator', 'support'])
            .withMessage('Invalid role'),
        
        body('isPremium')
            .optional()
            .isBoolean()
            .withMessage('isPremium must be a boolean'),
        
        body('isActive')
            .optional()
            .isBoolean()
            .withMessage('isActive must be a boolean')
    ],
    
    suspendUser: [
        body('reason')
            .notEmpty()
            .withMessage('Reason is required')
            .isLength({ min: 10, max: 500 })
            .withMessage('Reason must be between 10 and 500 characters')
    ],
    
    assignRole: [
        body('role')
            .notEmpty()
            .withMessage('Role is required')
            .isIn(['admin', 'moderator', 'support'])
            .withMessage('Invalid role')
    ],
    
    updateSetting: [
        body('key')
            .notEmpty()
            .withMessage('Setting key is required'),
        
        body('value')
            .notEmpty()
            .withMessage('Setting value is required')
    ],
    
    getAuditLogs: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        
        query('limit')
            .optional()
            .isInt({ min: 1, max: AdminConfig.pagination.maxLimit })
            .withMessage(`Limit must be between 1 and ${AdminConfig.pagination.maxLimit}`),
        
        query('action')
            .optional()
            .isIn(AdminConfig.auditLog.actions)
            .withMessage('Invalid action')
    ]
};

// ============================================
// ADMIN ROUTES
// ============================================

function createAdminRoutes(adminService, authMiddleware) {
    const router = require('express').Router();
    
    // ============ Dashboard ============
    
    // Get dashboard stats
    router.get('/dashboard', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const stats = await adminService.getDashboardStats();
        res.json(stats);
    });
    
    // Get system health
    router.get('/health', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const health = await adminService.getSystemHealth();
        res.json(health);
    });
    
    // ============ User Management ============
    
    // Get all users
    router.get('/users', authMiddleware.authenticate, authMiddleware.requireRole('admin'), AdminValidation.getUsers, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const filters = {
            search: req.query.search,
            role: req.query.role,
            isPremium: req.query.isPremium,
            isActive: req.query.isActive
        };
        
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || AdminConfig.userManagement.maxUsersPerPage,
            sortBy: req.query.sortBy || 'id',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const users = await adminService.getAllUsers(filters, options);
        res.json(users);
    });
    
    // Get user by ID
    router.get('/users/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const user = await adminService.getUserById(req.params.id);
            res.json(user);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    });
    
    // Update user
    router.put('/users/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), AdminValidation.updateUser, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const user = await adminService.updateUser(req.params.id, req.body, req.user.id);
            res.json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Suspend user
    router.post('/users/:id/suspend', authMiddleware.authenticate, authMiddleware.requireRole('admin'), AdminValidation.suspendUser, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const result = await adminService.suspendUser(req.params.id, req.body.reason, req.user.id);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Activate user
    router.post('/users/:id/activate', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const result = await adminService.activateUser(req.params.id, req.user.id);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Delete user
    router.delete('/users/:id', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        try {
            const result = await adminService.deleteUser(req.params.id, req.user.id);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Assign role to user
    router.post('/users/:id/role', authMiddleware.authenticate, authMiddleware.requireRole('admin'), AdminValidation.assignRole, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const result = await adminService.assignRole(req.params.id, req.body.role, req.user.id);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // ============ System Settings ============
    
    // Get all settings
    router.get('/settings', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const settings = await adminService.getSettings();
        res.json(settings);
    });
    
    // Update setting
    router.put('/settings/:key', authMiddleware.authenticate, authMiddleware.requireRole('admin'), AdminValidation.updateSetting, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const setting = await adminService.updateSetting(req.params.key, req.body.value, req.user.id);
            res.json(setting);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // ============ Audit Logs ============
    
    // Get audit logs
    router.get('/audit-logs', authMiddleware.authenticate, authMiddleware.requireRole('admin'), AdminValidation.getAuditLogs, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const filters = {
            userId: req.query.userId,
            action: req.query.action,
            resourceType: req.query.resourceType,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || AdminConfig.pagination.defaultLimit,
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const logs = await adminService.getAuditLogs(filters, options);
        res.json(logs);
    });
    
    // ============ Analytics ============
    
    // Get user analytics
    router.get('/analytics/users', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const analytics = await adminService.getUserAnalytics();
        res.json(analytics);
    });
    
    // Get revenue analytics
    router.get('/analytics/revenue', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const analytics = await adminService.getRevenueAnalytics();
        res.json(analytics);
    });
    
    // ============ System Monitoring ============
    
    // Get system metrics
    router.get('/metrics', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const period = parseInt(req.query.period) || 24;
        const metrics = await adminService.adminModel.getSystemMetrics(period);
        res.json(metrics);
    });
    
    // Get alerts
    router.get('/alerts', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const alerts = await adminService.adminModel.getActiveAlerts();
        res.json(alerts);
    });
    
    // Acknowledge alert
    router.post('/alerts/:id/acknowledge', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const alert = await adminService.adminModel.acknowledgeAlert(req.params.id, req.user.id);
        res.json(alert);
    });
    
    // Resolve alert
    router.post('/alerts/:id/resolve', authMiddleware.authenticate, authMiddleware.requireRole('admin'), async (req, res) => {
        const alert = await adminService.adminModel.resolveAlert(req.params.id);
        res.json(alert);
    });
    
    return router;
}

// ============================================
// EXPORTS
// ============================================

const adminModel = new AdminModel();
const adminService = new AdminService(adminModel);
const adminRoutes = createAdminRoutes(adminService, require('./auth').authMiddleware);

module.exports = {
    adminModel,
    adminService,
    adminRoutes,
    AdminConfig,
    AdminValidation
};
