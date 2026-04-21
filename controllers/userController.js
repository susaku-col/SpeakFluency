// ============================================
// User Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;

// ============================================
// Mock Database (In production, use real database)
// ============================================

// User storage (shared with auth controller)
const users = new Map();

// User activity logs
const userActivityLogs = new Map();

// User achievements
const userAchievements = new Map();

// User settings
const userSettings = new Map();

// User notifications
const userNotifications = new Map();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique ID
 */
const generateId = (prefix = 'user') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get user by ID
 */
const getUserById = (userId) => {
  for (const [_, user] of users.entries()) {
    if (user.id === userId) {
      return user;
    }
  }
  return null;
};

/**
 * Get user by email
 */
const getUserByEmail = (email) => {
  return users.get(email.toLowerCase()) || null;
};

/**
 * Update user
 */
const updateUser = (email, updates) => {
  const user = users.get(email.toLowerCase());
  if (!user) return null;
  
  const updatedUser = { ...user, ...updates, updatedAt: new Date().toISOString() };
  users.set(email.toLowerCase(), updatedUser);
  return updatedUser;
};

/**
 * Log user activity
 */
const logUserActivity = (userId, action, details = {}) => {
  const logId = generateId('activity');
  const log = {
    id: logId,
    userId,
    action,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip || null,
    userAgent: details.userAgent || null
  };
  
  if (!userActivityLogs.has(userId)) {
    userActivityLogs.set(userId, []);
  }
  
  const logs = userActivityLogs.get(userId);
  logs.push(log);
  
  // Keep only last 500 logs per user
  if (logs.length > 500) {
    userActivityLogs.set(userId, logs.slice(-500));
  }
  
  return log;
};

/**
 * Get user activity logs
 */
const getUserActivityLogs = (userId, limit = 50, offset = 0) => {
  const logs = userActivityLogs.get(userId) || [];
  return logs.slice(offset, offset + limit);
};

/**
 * Calculate level from XP
 */
const calculateLevel = (xp) => {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

/**
 * Calculate XP needed for next level
 */
const getXpToNextLevel = (currentLevel) => {
  return currentLevel * 1000;
};

/**
 * Calculate total XP needed for a level
 */
const getTotalXpForLevel = (level) => {
  return level * level * 100;
};

/**
 * Generate weekly progress data
 */
const generateWeeklyProgress = (userStats) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({
    day,
    score: Math.floor(Math.random() * 30) + 65,
    minutes: Math.floor(Math.random() * 45) + 15
  }));
};

/**
 * Generate monthly progress data
 */
const generateMonthlyProgress = (userStats) => {
  const data = [];
  for (let i = 0; i < 30; i++) {
    data.push({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      score: Math.floor(Math.random() * 30) + 60,
      minutes: Math.floor(Math.random() * 50) + 10,
      sessions: Math.floor(Math.random() * 4) + 1
    });
  }
  return data;
};

/**
 * Get user achievements
 */
const getUserAchievements = (userId) => {
  if (!userAchievements.has(userId)) {
    userAchievements.set(userId, []);
  }
  return userAchievements.get(userId);
};

/**
 * Add achievement to user
 */
const addUserAchievement = (userId, achievement) => {
  const achievements = getUserAchievements(userId);
  
  // Check if already has achievement
  if (achievements.some(a => a.id === achievement.id)) {
    return false;
  }
  
  achievements.push({
    ...achievement,
    earnedAt: new Date().toISOString()
  });
  
  userAchievements.set(userId, achievements);
  return true;
};

/**
 * Get user notifications
 */
const getUserNotifications = (userId, unreadOnly = false) => {
  const notifications = userNotifications.get(userId) || [];
  if (unreadOnly) {
    return notifications.filter(n => !n.isRead);
  }
  return notifications;
};

/**
 * Add notification for user
 */
const addUserNotification = (userId, title, message, type = 'info', actionUrl = null) => {
  const notification = {
    id: generateId('notif'),
    userId,
    title,
    message,
    type, // 'info', 'success', 'warning', 'error', 'achievement'
    actionUrl,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  
  if (!userNotifications.has(userId)) {
    userNotifications.set(userId, []);
  }
  
  const notifications = userNotifications.get(userId);
  notifications.unshift(notification);
  
  // Keep only last 100 notifications
  if (notifications.length > 100) {
    userNotifications.set(userId, notifications.slice(0, 100));
  }
  
  return notification;
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = (userId, notificationId) => {
  const notifications = userNotifications.get(userId) || [];
  const notification = notifications.find(n => n.id === notificationId);
  if (notification) {
    notification.isRead = true;
    notification.readAt = new Date().toISOString();
    userNotifications.set(userId, notifications);
    return true;
  }
  return false;
};

/**
 * Get user settings
 */
const getUserSettings = (userId) => {
  if (!userSettings.has(userId)) {
    userSettings.set(userId, {
      userId,
      preferences: {
        language: 'en',
        theme: 'light',
        fontSize: 'medium',
        reducedMotion: false,
        highContrast: false
      },
      notifications: {
        email: true,
        push: true,
        marketing: true,
        streakReminders: true,
        achievementAlerts: true,
        communityUpdates: false
      },
      privacy: {
        profileVisibility: 'public', // 'public', 'private', 'friends'
        showProgress: true,
        showAchievements: true,
        allowDataCollection: true
      },
      learning: {
        dailyGoal: 15, // minutes
        reminderTime: '19:00', // 7 PM
        autoPlayAudio: true,
        showTranscription: true,
        difficulty: 'auto' // 'auto', 'beginner', 'intermediate', 'advanced'
      },
      updatedAt: new Date().toISOString()
    });
  }
  return userSettings.get(userId);
};

/**
 * Update user settings
 */
const updateUserSettings = (userId, category, updates) => {
  const settings = getUserSettings(userId);
  
  if (settings[category]) {
    settings[category] = { ...settings[category], ...updates };
    settings.updatedAt = new Date().toISOString();
    userSettings.set(userId, settings);
  }
  
  return settings;
};

// ============================================
// Controller Methods
// ============================================

/**
 * Get user profile
 * GET /api/users/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Remove sensitive data
    const { password, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Update user profile
 * PUT /api/users/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const userId = req.user.id;
    const { name, avatar, bio, preferences } = req.body;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Update allowed fields
    const updates = {};
    if (name) updates.name = name.trim();
    if (avatar) updates.avatar = avatar;
    if (bio) updates.bio = bio.substring(0, 500);
    
    // Update preferences
    if (preferences) {
      updates.preferences = {
        ...user.preferences,
        ...preferences
      };
    }
    
    const updatedUser = updateUser(user.email, updates);
    
    // Log activity
    logUserActivity(userId, 'profile_update', { fields: Object.keys(updates) });
    
    const { password, ...userWithoutPassword } = updatedUser;
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get user statistics
 * GET /api/users/stats
 */
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const stats = user.stats || {
      totalSessions: 0,
      totalMinutes: 0,
      averageScore: 0,
      streak: 0,
      longestStreak: 0,
      level: 1,
      xp: 0,
      pronunciationScore: 0,
      vocabularyScore: 0,
      grammarScore: 0,
      fluencyScore: 0
    };
    
    const currentLevel = calculateLevel(stats.xp);
    const xpToNextLevel = getXpToNextLevel(currentLevel);
    const xpInCurrentLevel = stats.xp - getTotalXpForLevel(currentLevel - 1);
    
    // Get achievements
    const achievements = getUserAchievements(userId);
    const earnedAchievements = achievements.length;
    const totalAchievements = 20; // Mock total achievements
    
    // Generate recent activity
    const recentActivity = [
      {
        type: 'session',
        title: 'Pronunciation Practice',
        score: 85,
        xpEarned: 50,
        date: new Date().toISOString()
      },
      {
        type: 'achievement',
        title: '7 Day Streak',
        description: 'Maintained a 7-day learning streak',
        date: new Date(Date.now() - 86400000).toISOString()
      },
      {
        type: 'lesson',
        title: 'Basic Greetings',
        score: 92,
        completed: true,
        date: new Date(Date.now() - 172800000).toISOString()
      }
    ];
    
    res.json({
      success: true,
      data: {
        overview: {
          totalSessions: stats.totalSessions,
          totalMinutes: stats.totalMinutes,
          averageScore: Math.round(stats.averageScore),
          currentStreak: stats.streak,
          longestStreak: stats.longestStreak || stats.streak
        },
        level: {
          current: currentLevel,
          xp: stats.xp,
          xpToNextLevel,
          xpInCurrentLevel,
          progress: (xpInCurrentLevel / xpToNextLevel) * 100
        },
        skills: {
          pronunciation: stats.pronunciationScore || 75,
          vocabulary: stats.vocabularyScore || 80,
          grammar: stats.grammarScore || 70,
          fluency: stats.fluencyScore || 65
        },
        achievements: {
          earned: earnedAchievements,
          total: totalAchievements,
          percentage: (earnedAchievements / totalAchievements) * 100,
          recent: achievements.slice(-5)
        },
        weeklyProgress: generateWeeklyProgress(stats),
        recentActivity
      }
    });
    
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get user progress over time
 * GET /api/users/progress
 */
exports.getProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'week', metric = 'score' } = req.query;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    let progressData;
    let labels;
    
    switch (period) {
      case 'week':
        progressData = generateWeeklyProgress(user.stats).map(d => d.score);
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        break;
      case 'month':
        const monthlyData = generateMonthlyProgress(user.stats);
        progressData = monthlyData.map(d => d.score);
        labels = monthlyData.map(d => d.date);
        break;
      case 'year':
        progressData = [];
        labels = [];
        for (let i = 0; i < 12; i++) {
          const month = new Date(2024, i, 1).toLocaleString('default', { month: 'short' });
          labels.push(month);
          progressData.push(Math.floor(Math.random() * 30) + 65);
        }
        break;
      default:
        progressData = generateWeeklyProgress(user.stats).map(d => d.score);
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    }
    
    // Calculate moving average (7-day)
    const movingAverage = [];
    for (let i = 0; i < progressData.length; i++) {
      const start = Math.max(0, i - 6);
      const window = progressData.slice(start, i + 1);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      movingAverage.push(Math.round(avg));
    }
    
    // Calculate improvement
    const firstWeek = progressData.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
    const lastWeek = progressData.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const improvement = ((lastWeek - firstWeek) / firstWeek) * 100;
    
    res.json({
      success: true,
      data: {
        period,
        metric,
        labels,
        data: progressData,
        movingAverage,
        summary: {
          start: progressData[0],
          end: progressData[progressData.length - 1],
          best: Math.max(...progressData),
          worst: Math.min(...progressData),
          average: progressData.reduce((a, b) => a + b, 0) / progressData.length,
          improvement: Math.round(improvement * 100) / 100
        }
      }
    });
    
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get user settings
 * GET /api/users/settings
 */
exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const settings = getUserSettings(userId);
    
    res.json({
      success: true,
      data: settings
    });
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Update user settings
 * PUT /api/users/settings
 */
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, updates } = req.body;
    
    if (!category || !updates) {
      return res.status(400).json({
        success: false,
        error: 'Category and updates are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    const validCategories = ['preferences', 'notifications', 'privacy', 'learning'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category',
        code: 'INVALID_CATEGORY'
      });
    }
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const updatedSettings = updateUserSettings(userId, category, updates);
    
    // Log activity
    logUserActivity(userId, 'settings_update', { category, updates: Object.keys(updates) });
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedSettings
    });
    
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Change email
 * PUT /api/users/profile/email
 */
exports.changeEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const userId = req.user.id;
    const { email: newEmail, password } = req.body;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        code: 'INVALID_PASSWORD'
      });
    }
    
    // Check if new email already exists
    const existingUser = getUserByEmail(newEmail);
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({
        success: false,
        error: 'Email already in use',
        code: 'EMAIL_EXISTS'
      });
    }
    
    // Update email
    const oldEmail = user.email;
    users.delete(oldEmail);
    user.email = newEmail.toLowerCase();
    user.isEmailVerified = false;
    user.emailUpdatedAt = new Date().toISOString();
    users.set(newEmail.toLowerCase(), user);
    
    // Generate new token
    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'speakflow-secret',
      { expiresIn: '7d' }
    );
    
    // Log activity
    logUserActivity(userId, 'email_change', { oldEmail, newEmail });
    
    res.json({
      success: true,
      message: 'Email updated successfully. Please verify your new email.',
      data: {
        token: newToken,
        email: user.email,
        requiresVerification: true
      }
    });
    
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Delete user account
 * DELETE /api/users/profile
 */
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Verify password if account has password
    if (user.password) {
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password',
          code: 'INVALID_PASSWORD'
        });
      }
    }
    
    // Log before deletion
    logUserActivity(userId, 'account_deletion', { email: user.email });
    
    // Delete user data
    users.delete(user.email);
    userActivityLogs.delete(userId);
    userAchievements.delete(userId);
    userSettings.delete(userId);
    userNotifications.delete(userId);
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get user activity history
 * GET /api/users/activity
 */
exports.getActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, action } = req.query;
    
    let logs = getUserActivityLogs(userId, parseInt(limit), parseInt(offset));
    
    if (action) {
      logs = logs.filter(log => log.action === action);
    }
    
    // Get available actions
    const availableActions = [...new Set(getUserActivityLogs(userId).map(l => l.action))];
    
    res.json({
      success: true,
      data: {
        activities: logs,
        availableActions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: (userActivityLogs.get(userId) || []).length
        }
      }
    });
    
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get user achievements
 * GET /api/users/achievements
 */
exports.getAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const earnedAchievements = getUserAchievements(userId);
    
    // Define all possible achievements
    const allAchievements = [
      { id: 'first_lesson', name: 'First Step', description: 'Complete your first lesson', icon: '🎯', points: 50 },
      { id: 'ten_lessons', name: 'Dedicated Learner', description: 'Complete 10 lessons', icon: '📚', points: 100 },
      { id: 'fifty_lessons', name: 'Language Enthusiast', description: 'Complete 50 lessons', icon: '⭐', points: 250 },
      { id: 'hundred_lessons', name: 'Master', description: 'Complete 100 lessons', icon: '🏆', points: 500 },
      { id: 'seven_day_streak', name: 'Week Warrior', description: '7-day learning streak', icon: '🔥', points: 100 },
      { id: 'thirty_day_streak', name: 'Monthly Master', description: '30-day learning streak', icon: '📅', points: 500 },
      { id: 'perfect_score', name: 'Perfectionist', description: 'Get a perfect score', icon: '💯', points: 150 },
      { id: 'early_bird', name: 'Early Bird', description: 'Complete lesson before 8 AM', icon: '🌅', points: 50 },
      { id: 'night_owl', name: 'Night Owl', description: 'Complete lesson after 10 PM', icon: '🦉', points: 50 },
      { id: 'vocabulary_master', name: 'Vocabulary Master', description: 'Learn 500 words', icon: '📖', points: 200 },
      { id: 'grammar_guru', name: 'Grammar Guru', description: 'Complete all grammar lessons', icon: '✍️', points: 200 },
      { id: 'pronunciation_pro', name: 'Pronunciation Pro', description: 'Get 90%+ on pronunciation', icon: '🎤', points: 200 }
    ];
    
    // Mark which ones are earned
    const achievementsWithStatus = allAchievements.map(achievement => {
      const earned = earnedAchievements.find(e => e.id === achievement.id);
      return {
        ...achievement,
        earned: !!earned,
        earnedAt: earned?.earnedAt || null
      };
    });
    
    // Calculate total points
    const totalPoints = earnedAchievements.reduce((sum, a) => {
      const achievement = allAchievements.find(ach => ach.id === a.id);
      return sum + (achievement?.points || 0);
    }, 0);
    
    res.json({
      success: true,
      data: {
        summary: {
          earned: earnedAchievements.length,
          total: allAchievements.length,
          percentage: (earnedAchievements.length / allAchievements.length) * 100,
          totalPoints
        },
        achievements: achievementsWithStatus,
        recentEarned: earnedAchievements.slice(-5)
      }
    });
    
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get user notifications
 * GET /api/users/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { unreadOnly = false, limit = 20 } = req.query;
    
    const notifications = getUserNotifications(userId, unreadOnly === 'true');
    const limitedNotifications = notifications.slice(0, parseInt(limit));
    
    const unreadCount = getUserNotifications(userId, true).length;
    
    res.json({
      success: true,
      data: {
        notifications: limitedNotifications,
        unreadCount,
        total: notifications.length
      }
    });
    
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Mark notification as read
 * PUT /api/users/notifications/:notificationId/read
 */
exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    
    const result = markNotificationAsRead(userId, notificationId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
        code: 'NOTIFICATION_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
    
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Mark all notifications as read
 * PUT /api/users/notifications/read-all
 */
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const notifications = getUserNotifications(userId);
    notifications.forEach(notification => {
      notification.isRead = true;
      notification.readAt = new Date().toISOString();
    });
    
    userNotifications.set(userId, notifications);
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
    
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Clear all notifications
 * DELETE /api/users/notifications
 */
exports.clearNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    userNotifications.set(userId, []);
    
    res.json({
      success: true,
      message: 'All notifications cleared'
    });
    
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get dashboard data
 * GET /api/users/dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const stats = user.stats || {};
    const currentLevel = calculateLevel(stats.xp || 0);
    const achievements = getUserAchievements(userId);
    
    // Get unread notifications count
    const unreadNotifications = getUserNotifications(userId, true).length;
    
    // Get next achievement
    const allAchievements = [
      { id: 'ten_lessons', name: '10 Lessons', requirement: 10, current: stats.totalSessions || 0, icon: '📚' },
      { id: 'fifty_lessons', name: '50 Lessons', requirement: 50, current: stats.totalSessions || 0, icon: '⭐' },
      { id: 'seven_day_streak', name: '7 Day Streak', requirement: 7, current: stats.streak || 0, icon: '🔥' }
    ];
    
    const nextAchievement = allAchievements
      .filter(a => a.current < a.requirement)
      .sort((a, b) => (a.current / a.requirement) - (b.current / b.requirement))[0];
    
    // Get recommended lessons
    const recommendedLessons = [
      { id: 'lesson_1', title: 'Basic Greetings', type: 'pronunciation', duration: 10, difficulty: 'beginner' },
      { id: 'lesson_2', title: 'Numbers 1-20', type: 'vocabulary', duration: 15, difficulty: 'beginner' },
      { id: 'lesson_3', title: 'Present Simple Tense', type: 'grammar', duration: 20, difficulty: 'beginner' }
    ];
    
    res.json({
      success: true,
      data: {
        welcome: {
          name: user.name,
          message: getWelcomeMessage(user.name, stats.streak || 0)
        },
        stats: {
          streak: stats.streak || 0,
          level: currentLevel,
          xp: stats.xp || 0,
          xpToNextLevel: getXpToNextLevel(currentLevel),
          achievementsEarned: achievements.length,
          unreadNotifications
        },
        nextAchievement: nextAchievement ? {
          id: nextAchievement.id,
          name: nextAchievement.name,
          progress: (nextAchievement.current / nextAchievement.requirement) * 100,
          current: nextAchievement.current,
          target: nextAchievement.requirement,
          icon: nextAchievement.icon
        } : null,
        recommendedLessons,
        weeklyProgress: generateWeeklyProgress(stats),
        quote: getDailyQuote()
      }
    });
    
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ============================================
// Helper Functions for Dashboard
// ============================================

const getWelcomeMessage = (name, streak) => {
  const hour = new Date().getHours();
  let timeGreeting = '';
  
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 18) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';
  
  let streakMessage = '';
  if (streak > 0) {
    streakMessage = ` 🔥 ${streak} day streak!`;
  }
  
  return `${timeGreeting}, ${name}!${streakMessage}`;
};

const getDailyQuote = () => {
  const quotes = [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Practice makes perfect.", author: "Proverb" },
    { text: "Every expert was once a beginner.", author: "Unknown" },
    { text: "Learning is a treasure that will follow its owner everywhere.", author: "Chinese Proverb" },
    { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" }
  ];
  
  const index = new Date().getDate() % quotes.length;
  return quotes[index];
};

// ============================================
// Export all methods
// ============================================

module.exports = exports;
