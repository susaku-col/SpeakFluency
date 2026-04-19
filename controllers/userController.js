/* ============================================
   SPEAKFLOW - USER CONTROLLER
   Version: 1.0.0
   Handles user management HTTP requests and responses
   ============================================ */

const { validationResult } = require('express-validator');

// ============================================
// USER CONTROLLER
// ============================================

class UserController {
    constructor(userService) {
        this.userService = userService;
    }

    /**
     * Get current user profile
     * GET /api/users/me
     */
    getCurrentUser = async (req, res) => {
        try {
            const user = await this.userService.getUserProfile(req.user.id);
            
            return res.json({
                success: true,
                data: { user }
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Update current user profile
     * PUT /api/users/me
     */
    updateCurrentUser = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        try {
            const updatedUser = await this.userService.updateProfile(req.user.id, req.body);
            
            return res.json({
                success: true,
                message: 'Profile updated successfully',
                data: { user: updatedUser }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get user preferences
     * GET /api/users/me/preferences
     */
    getUserPreferences = async (req, res) => {
        try {
            const preferences = await this.userService.getUserPreferences(req.user.id);
            
            return res.json({
                success: true,
                data: { preferences }
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Update user preferences
     * PUT /api/users/me/preferences
     */
    updateUserPreferences = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        try {
            const updated = await this.userService.updatePreferences(req.user.id, req.body);
            
            return res.json({
                success: true,
                message: 'Preferences updated successfully',
                data: { preferences: updated }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get user stats
     * GET /api/users/me/stats
     */
    getUserStats = async (req, res) => {
        try {
            const stats = await this.userService.getUserStats(req.user.id);
            
            return res.json({
                success: true,
                data: { stats }
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get user activity
     * GET /api/users/me/activity
     */
    getUserActivity = async (req, res) => {
        const limit = parseInt(req.query.limit) || 20;
        
        try {
            const activity = await this.userService.getUserActivity(req.user.id, limit);
            
            return res.json({
                success: true,
                data: { activity }
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get user analytics
     * GET /api/users/me/analytics
     */
    getUserAnalytics = async (req, res) => {
        const period = parseInt(req.query.period) || 30;
        
        try {
            const analytics = await this.userService.getUserAnalytics(req.user.id, period);
            
            return res.json({
                success: true,
                data: { analytics }
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get dashboard stats
     * GET /api/users/me/dashboard
     */
    getDashboard = async (req, res) => {
        try {
            const dashboard = await this.userService.getDashboardStats(req.user.id);
            
            return res.json({
                success: true,
                data: { dashboard }
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Record practice session
     * POST /api/users/me/practice
     */
    recordPractice = async (req, res) => {
        const { score, duration, transcript, scores } = req.body;
        
        if (!score) {
            return res.status(400).json({
                success: false,
                error: 'Score is required'
            });
        }

        try {
            const result = await this.userService.recordPracticeSession(req.user.id, {
                score,
                duration,
                transcript,
                scores
            });
            
            return res.json({
                success: true,
                message: 'Practice session recorded',
                data: result
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Add XP to user
     * POST /api/users/me/xp
     */
    addXP = async (req, res) => {
        const { amount, source } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid XP amount is required'
            });
        }

        try {
            const result = await this.userService.addXP(req.user.id, amount, source);
            
            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Update streak
     * POST /api/users/me/streak
     */
    updateStreak = async (req, res) => {
        try {
            const result = await this.userService.updateStreak(req.user.id);
            
            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Add achievement
     * POST /api/users/me/achievements
     */
    addAchievement = async (req, res) => {
        const { achievementId } = req.body;
        
        if (!achievementId) {
            return res.status(400).json({
                success: false,
                error: 'Achievement ID is required'
            });
        }

        try {
            const result = await this.userService.addAchievement(req.user.id, achievementId);
            
            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Add badge
     * POST /api/users/me/badges
     */
    addBadge = async (req, res) => {
        const { badgeId } = req.body;
        
        if (!badgeId) {
            return res.status(400).json({
                success: false,
                error: 'Badge ID is required'
            });
        }

        try {
            const result = await this.userService.addBadge(req.user.id, badgeId);
            
            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get leaderboard
     * GET /api/users/leaderboard
     */
    getLeaderboard = async (req, res) => {
        const period = req.query.period || 'all';
        const limit = parseInt(req.query.limit) || 50;
        
        try {
            const leaderboard = await this.userService.getLeaderboard(period, limit);
            
            return res.json({
                success: true,
                data: { leaderboard, period, limit }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Search users (admin only)
     * GET /api/users/search
     */
    searchUsers = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { q, page, limit, sortBy, sortOrder } = req.query;
        
        try {
            const result = await this.userService.searchUsers(q, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 20,
                sortBy: sortBy || 'createdAt',
                sortOrder: sortOrder || 'desc'
            });
            
            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get user by ID (admin only)
     * GET /api/users/:id
     */
    getUserById = async (req, res) => {
        try {
            const user = await this.userService.getUserProfile(req.params.id);
            
            return res.json({
                success: true,
                data: { user }
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Update user by ID (admin only)
     * PUT /api/users/:id
     */
    updateUserById = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        try {
            const updated = await this.userService.updateProfile(req.params.id, req.body);
            
            return res.json({
                success: true,
                message: 'User updated successfully',
                data: { user: updated }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Delete user (admin only)
     * DELETE /api/users/:id
     */
    deleteUserById = async (req, res) => {
        const softDelete = req.query.soft !== 'false';
        
        try {
            await this.userService.deleteUser(req.params.id, softDelete);
            
            return res.json({
                success: true,
                message: softDelete ? 'User deactivated' : 'User permanently deleted'
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get admin stats (admin only)
     * GET /api/users/admin/stats
     */
    getAdminStats = async (req, res) => {
        try {
            const stats = await this.userService.getAdminStats();
            
            return res.json({
                success: true,
                data: { stats }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Export users data (admin only)
     * GET /api/users/export
     */
    exportUsers = async (req, res) => {
        const format = req.query.format || 'csv';
        const filters = {
            role: req.query.role,
            isPremium: req.query.isPremium,
            isActive: req.query.isActive,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        
        try {
            const exportData = await this.userService.exportUsers(filters, format);
            
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=users_${Date.now()}.csv`);
                return res.send(exportData);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename=users_${Date.now()}.json`);
                return res.send(exportData);
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Bulk update users (admin only)
     * POST /api/users/bulk/update
     */
    bulkUpdateUsers = async (req, res) => {
        const { userIds, updates } = req.body;
        
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'User IDs array is required'
            });
        }
        
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Updates object is required'
            });
        }

        try {
            const result = await this.userService.bulkUpdateUsers(userIds, updates);
            
            return res.json({
                success: true,
                message: `${result.updated} users updated successfully`,
                data: result
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get user growth stats (admin only)
     * GET /api/users/stats/growth
     */
    getUserGrowth = async (req, res) => {
        const days = parseInt(req.query.days) || 30;
        
        try {
            const growth = await this.userService.getUserGrowth(days);
            
            return res.json({
                success: true,
                data: { growth, days }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get user retention stats (admin only)
     * GET /api/users/stats/retention
     */
    getUserRetention = async (req, res) => {
        const cohort = req.query.cohort || 'weekly';
        
        try {
            const retention = await this.userService.getUserRetention(cohort);
            
            return res.json({
                success: true,
                data: { retention, cohort }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get user segmentation (admin only)
     * GET /api/users/stats/segments
     */
    getUserSegments = async (req, res) => {
        try {
            const segments = await this.userService.getUserSegments();
            
            return res.json({
                success: true,
                data: { segments }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Send notification to users (admin only)
     * POST /api/users/notify
     */
    sendUserNotification = async (req, res) => {
        const { userIds, title, body, type } = req.body;
        
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'User IDs array is required'
            });
        }
        
        if (!title || !body) {
            return res.status(400).json({
                success: false,
                error: 'Title and body are required'
            });
        }

        try {
            const result = await this.userService.sendNotification(userIds, {
                title,
                body,
                type: type || 'system'
            });
            
            return res.json({
                success: true,
                message: `Notification sent to ${result.sent} users`,
                data: result
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };
}

module.exports = UserController;
