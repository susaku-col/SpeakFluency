// ============================================
// Users Management Routes
// SpeakFlow - AI Language Learning Platform
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// ============================================
// Middleware Authentication
// ============================================

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Admin middleware
const isAdmin = async (req, res, next) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ============================================
// Validation Rules
// ============================================

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('preferences.language')
    .optional()
    .isIn(['en', 'es', 'fr', 'ja', 'ko', 'zh'])
    .withMessage('Invalid language selection'),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'system'])
    .withMessage('Invalid theme selection'),
  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications must be boolean'),
];

const updateEmailValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required to update email'),
];

const adminUpdateUserValidation = [
  body('role')
    .optional()
    .isIn(['user', 'premium', 'admin', 'moderator'])
    .withMessage('Invalid role'),
  body('status')
    .optional()
    .isIn(['active', 'suspended', 'banned', 'inactive'])
    .withMessage('Invalid status'),
  body('subscription.plan')
    .optional()
    .isIn(['free', 'pro', 'family', 'enterprise'])
    .withMessage('Invalid subscription plan'),
];

// ============================================
// Helper Functions
// ============================================

// Mock user database (in production, use real database)
const users = new Map();

// Initialize with demo users
const initDemoUsers = async () => {
  const hashedPassword = await bcrypt.hash('demo123', 10);
  
  // Admin user
  users.set('admin@speakflow.com', {
    id: 'admin-1',
    email: 'admin@speakflow.com',
    password: hashedPassword,
    name: 'Admin User',
    role: 'admin',
    status: 'active',
    avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=4F46E5&color=fff',
    bio: 'SpeakFlow Administrator',
    isEmailVerified: true,
    createdAt: new Date('2024-01-01').toISOString(),
    lastLogin: new Date().toISOString(),
    preferences: {
      language: 'en',
      theme: 'light',
      notifications: true,
      emailNotifications: true,
      pushNotifications: true
    },
    stats: {
      totalSessions: 0,
      totalMinutes: 0,
      averageScore: 0,
      streak: 0,
      level: 1,
      xp: 0
    },
    subscription: {
      plan: 'free',
      status: 'active',
      startDate: new Date('2024-01-01').toISOString(),
      endDate: null
    }
  });

  // Premium user
  users.set('premium@speakflow.com', {
    id: 'premium-1',
    email: 'premium@speakflow.com',
    password: hashedPassword,
    name: 'Premium User',
    role: 'premium',
    status: 'active',
    avatar: 'https://ui-avatars.com/api/?name=Premium+User&background=10B981&color=fff',
    bio: 'Learning English with SpeakFlow',
    isEmailVerified: true,
    createdAt: new Date('2024-01-15').toISOString(),
    lastLogin: new Date().toISOString(),
    preferences: {
      language: 'en',
      theme: 'dark',
      notifications: true,
      emailNotifications: true,
      pushNotifications: true
    },
    stats: {
      totalSessions: 127,
      totalMinutes: 3810,
      averageScore: 85,
      streak: 21,
      level: 15,
      xp: 12500
    },
    subscription: {
      plan: 'pro',
      status: 'active',
      startDate: new Date('2024-01-15').toISOString(),
      endDate: new Date('2025-01-15').toISOString()
    }
  });

  // Regular user
  users.set('user@speakflow.com', {
    id: 'user-1',
    email: 'user@speakflow.com',
    password: hashedPassword,
    name: 'Regular User',
    role: 'user',
    status: 'active',
    avatar: 'https://ui-avatars.com/api/?name=Regular+User&background=6366F1&color=fff',
    bio: 'Practicing English daily',
    isEmailVerified: true,
    createdAt: new Date('2024-02-01').toISOString(),
    lastLogin: new Date().toISOString(),
    preferences: {
      language: 'en',
      theme: 'light',
      notifications: true,
      emailNotifications: false,
      pushNotifications: true
    },
    stats: {
      totalSessions: 45,
      totalMinutes: 1350,
      averageScore: 78,
      streak: 7,
      level: 8,
      xp: 4500
    },
    subscription: {
      plan: 'free',
      status: 'active',
      startDate: new Date('2024-02-01').toISOString(),
      endDate: null
    }
  });
};

// Get user by ID
const getUserById = async (id) => {
  return Array.from(users.values()).find(user => user.id === id);
};

// Get user by email
const getUserByEmail = async (email) => {
  return users.get(email);
};

// Update user data
const updateUser = async (email, updates) => {
  const user = users.get(email);
  if (!user) return null;
  
  const updatedUser = { ...user, ...updates };
  users.set(email, updatedUser);
  return updatedUser;
};

// Hash password
const hashPassword = async (password) => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  return await bcrypt.hash(password, saltRounds);
};

// Initialize demo users
initDemoUsers();

// ============================================
// Routes
// ============================================

/**
 * GET /api/users/profile
 * Get current user profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

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
});

/**
 * PUT /api/users/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, updateProfileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'avatar', 'bio', 'preferences'];
    const updates = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Merge preferences
    if (req.body.preferences) {
      updates.preferences = {
        ...user.preferences,
        ...req.body.preferences
      };
    }

    const updatedUser = await updateUser(user.email, updates);
    const { password: _, ...userWithoutPassword } = updatedUser;

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
});

/**
 * PUT /api/users/profile/email
 * Update user email
 */
router.put('/profile/email', authenticateToken, updateEmailValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email: newEmail, password } = req.body;
    const user = await getUserById(req.user.id);

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
    const existingUser = await getUserByEmail(newEmail);
    if (existingUser && existingUser.id !== user.id) {
      return res.status(409).json({
        success: false,
        error: 'Email already in use',
        code: 'EMAIL_EXISTS'
      });
    }

    // Update email
    users.delete(user.email);
    user.email = newEmail;
    user.isEmailVerified = false;
    users.set(newEmail, user);

    // Generate new token
    const newToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Email updated successfully. Please verify your new email.',
      data: {
        token: newToken
      }
    });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/users/profile
 * Delete user account
 */
router.delete('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // In production: soft delete or anonymize user data
    users.delete(user.email);

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
});

/**
 * GET /api/users/stats
 * Get user learning statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const stats = {
      overview: {
        totalSessions: user.stats.totalSessions,
        totalMinutes: user.stats.totalMinutes,
        averageScore: user.stats.averageScore,
        currentStreak: user.stats.streak,
        longestStreak: user.stats.longestStreak || user.stats.streak,
        level: user.stats.level,
        xp: user.stats.xp,
        xpToNextLevel: calculateXpToNextLevel(user.stats.level)
      },
      weeklyProgress: generateWeeklyProgress(),
      skillLevels: {
        pronunciation: user.stats.pronunciationScore || 75,
        vocabulary: user.stats.vocabularyScore || 80,
        grammar: user.stats.grammarScore || 70,
        fluency: user.stats.fluencyScore || 65
      },
      achievements: {
        total: 12,
        earned: user.achievements?.length || 5,
        recent: user.recentAchievements || []
      },
      badges: user.badges || [],
      monthlyActivity: generateMonthlyActivity()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/users/progress
 * Get user learning progress over time
 */
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const user = await getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    let progressData;
    switch (period) {
      case 'week':
        progressData = generateWeeklyProgress();
        break;
      case 'month':
        progressData = generateMonthlyProgress();
        break;
      case 'year':
        progressData = generateYearlyProgress();
        break;
      default:
        progressData = generateWeeklyProgress();
    }

    res.json({
      success: true,
      data: {
        period,
        progress: progressData,
        summary: {
          improvement: '+15%',
          consistency: '85%',
          totalPracticeTime: user.stats.totalMinutes,
          averageDailyScore: user.stats.averageScore
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
});

/**
 * GET /api/users/settings
 * Get user settings
 */
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        preferences: user.preferences,
        notifications: {
          email: user.preferences.emailNotifications,
          push: user.preferences.pushNotifications,
          marketing: user.preferences.marketingEmails || false
        },
        privacy: {
          profileVisibility: user.privacy?.profileVisibility || 'public',
          shareProgress: user.privacy?.shareProgress || true
        },
        language: user.preferences.language,
        theme: user.preferences.theme
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/users/settings
 * Update user settings
 */
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { preferences, notifications, privacy, language, theme } = req.body;

    // Update preferences
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    // Update notification settings
    if (notifications) {
      user.preferences.emailNotifications = notifications.email;
      user.preferences.pushNotifications = notifications.push;
      user.preferences.marketingEmails = notifications.marketing;
    }

    // Update privacy settings
    if (privacy) {
      user.privacy = { ...user.privacy, ...privacy };
    }

    // Update language
    if (language) {
      user.preferences.language = language;
    }

    // Update theme
    if (theme) {
      user.preferences.theme = theme;
    }

    await updateUser(user.email, user);

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        preferences: user.preferences,
        privacy: user.privacy
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ============================================
// Admin Routes (require admin role)
// ============================================

/**
 * GET /api/users/admin/all
 * Get all users (admin only)
 */
router.get('/admin/all', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;
    
    let userList = Array.from(users.values());
    
    // Filter by search
    if (search) {
      userList = userList.filter(user => 
        user.email.includes(search) || 
        user.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Filter by role
    if (role) {
      userList = userList.filter(user => user.role === role);
    }
    
    // Filter by status
    if (status) {
      userList = userList.filter(user => user.status === status);
    }
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedUsers = userList.slice(startIndex, startIndex + limit);
    
    // Remove passwords from response
    const safeUsers = paginatedUsers.map(user => {
      const { password: _, ...safeUser } = user;
      return safeUser;
    });

    res.json({
      success: true,
      data: {
        users: safeUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: userList.length,
          pages: Math.ceil(userList.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/users/admin/:userId
 * Get user by ID (admin only)
 */
router.get('/admin/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { password: _, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/users/admin/:userId
 * Update user (admin only)
 */
router.put('/admin/:userId', authenticateToken, isAdmin, adminUpdateUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId } = req.params;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['role', 'status', 'subscription'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await updateUser(user.email, user);
    
    const { password: _, ...safeUser } = user;

    res.json({
      success: true,
      message: 'User updated successfully',
      data: safeUser
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/users/admin/:userId
 * Delete user (admin only)
 */
router.delete('/admin/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
        code: 'CANNOT_DELETE_SELF'
      });
    }

    users.delete(user.email);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/users/admin/:userId/suspend
 * Suspend user account (admin only)
 */
router.post('/admin/:userId/suspend', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration = '30d' } = req.body;
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    user.status = 'suspended';
    user.suspension = {
      reason: reason || 'Violation of terms',
      suspendedAt: new Date().toISOString(),
      duration: duration,
      suspendedBy: req.user.id
    };

    await updateUser(user.email, user);

    res.json({
      success: true,
      message: 'User suspended successfully',
      data: {
        userId: user.id,
        status: user.status,
        suspension: user.suspension
      }
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/users/admin/:userId/activate
 * Activate user account (admin only)
 */
router.post('/admin/:userId/activate', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    user.status = 'active';
    delete user.suspension;

    await updateUser(user.email, user);

    res.json({
      success: true,
      message: 'User activated successfully',
      data: {
        userId: user.id,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ============================================
// Helper Functions for Mock Data
// ============================================

const calculateXpToNextLevel = (currentLevel) => {
  return currentLevel * 1000;
};

const generateWeeklyProgress = () => {
  return [65, 72, 80, 78, 85, 88, 92];
};

const generateMonthlyProgress = () => {
  const data = [];
  for (let i = 0; i < 30; i++) {
    data.push(Math.floor(Math.random() * 40) + 60);
  }
  return data;
};

const generateYearlyProgress = () => {
  const data = [];
  for (let i = 0; i < 12; i++) {
    data.push(Math.floor(Math.random() * 30) + 70);
  }
  return data;
};

const generateMonthlyActivity = () => {
  const data = [];
  for (let i = 0; i < 30; i++) {
    data.push({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      sessions: Math.floor(Math.random() * 5),
      minutes: Math.floor(Math.random() * 60),
      score: Math.floor(Math.random() * 30) + 70
    });
  }
  return data;
};

// ============================================
// Export Router
// ============================================

module.exports = router;
