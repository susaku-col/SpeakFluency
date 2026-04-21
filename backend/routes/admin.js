// ============================================
// Admin Routes
// SpeakFlow - AI Language Learning Platform
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, query, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// ============================================
// Middleware Authentication
// ============================================

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
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Super Admin middleware
const isSuperAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ============================================
// Rate Limiting
// ============================================

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: 'Too many admin requests. Please slow down.'
  }
});

// ============================================
// Validation Rules
// ============================================

const updateUserValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format'),
  body('role')
    .optional()
    .isIn(['user', 'premium', 'moderator', 'support', 'admin', 'super_admin'])
    .withMessage('Invalid role'),
  body('status')
    .optional()
    .isIn(['active', 'suspended', 'banned', 'inactive'])
    .withMessage('Invalid status'),
];

const createAdminValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('name')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('role')
    .isIn(['admin', 'moderator', 'support'])
    .withMessage('Invalid role for new admin'),
];

const systemSettingsValidation = [
  body('key')
    .notEmpty()
    .withMessage('Setting key is required'),
  body('value')
    .notEmpty()
    .withMessage('Setting value is required'),
];

// ============================================
// Admin Data Storage
// ============================================

// Admin audit logs
const adminLogs = new Map();

// System settings
const systemSettings = new Map();

// Admin activity
const adminActivity = new Map();

// Banned IPs
const bannedIPs = new Set();

// System health metrics
const systemHealth = new Map();

// ============================================
// Mock Data
// ============================================

// System settings defaults
const defaultSettings = [
  { key: 'site_name', value: 'SpeakFlow', category: 'general', description: 'Website name' },
  { key: 'site_description', value: 'AI-Powered Language Learning Platform', category: 'general', description: 'Website description' },
  { key: 'maintenance_mode', value: false, category: 'system', description: 'Enable maintenance mode' },
  { key: 'registration_enabled', value: true, category: 'system', description: 'Allow new user registration' },
  { key: 'email_verification', value: true, category: 'security', description: 'Require email verification' },
  { key: 'max_login_attempts', value: 5, category: 'security', description: 'Maximum login attempts before lockout' },
  { key: 'session_timeout', value: 86400, category: 'security', description: 'Session timeout in seconds' },
  { key: 'default_language', value: 'en', category: 'localization', description: 'Default site language' },
  { key: 'supported_languages', value: ['en', 'es', 'fr', 'ja', 'ko'], category: 'localization', description: 'Supported languages' },
  { key: 'free_lessons_per_day', value: 3, category: 'subscription', description: 'Free tier daily lesson limit' },
  { key: 'referral_bonus', value: 50, category: 'marketing', description: 'Referral bonus XP' },
  { key: 'maintenance_message', value: 'We are currently performing maintenance. Please check back soon.', category: 'system', description: 'Maintenance mode message' }
];

defaultSettings.forEach(setting => {
  systemSettings.set(setting.key, setting);
});

// Mock admin users
const adminUsers = [
  {
    id: 'admin_1',
    email: 'superadmin@speakflow.com',
    name: 'Super Admin',
    role: 'super_admin',
    status: 'active',
    lastLogin: new Date().toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    permissions: ['*']
  },
  {
    id: 'admin_2',
    email: 'admin@speakflow.com',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
    lastLogin: new Date().toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    permissions: ['users.read', 'users.update', 'content.manage', 'analytics.view']
  },
  {
    id: 'admin_3',
    email: 'moderator@speakflow.com',
    name: 'Moderator',
    role: 'moderator',
    status: 'active',
    lastLogin: new Date().toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    permissions: ['users.read', 'content.moderate']
  }
];

// Mock system health metrics
const updateSystemHealth = () => {
  systemHealth.set('cpu_usage', Math.random() * 60 + 20);
  systemHealth.set('memory_usage', Math.random() * 70 + 20);
  systemHealth.set('disk_usage', Math.random() * 50 + 30);
  systemHealth.set('active_users', Math.floor(Math.random() * 5000) + 1000);
  systemHealth.set('active_sessions', Math.floor(Math.random() * 8000) + 2000);
  systemHealth.set('api_requests_per_minute', Math.floor(Math.random() * 1000) + 500);
  systemHealth.set('error_rate', Math.random() * 2);
  systemHealth.set('response_time', Math.random() * 200 + 50);
  systemHealth.set('uptime', 99.95);
};

updateSystemHealth();
setInterval(updateSystemHealth, 60000); // Update every minute

// ============================================
// Helper Functions
// ============================================

// Generate unique ID
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Log admin action
const logAdminAction = (adminId, action, details = {}, ip = null) => {
  const logId = generateId('log');
  const log = {
    id: logId,
    adminId,
    action,
    details,
    ip,
    timestamp: new Date().toISOString()
  };
  
  if (!adminLogs.has(adminId)) {
    adminLogs.set(adminId, []);
  }
  adminLogs.get(adminId).push(log);
  
  // Keep only last 1000 logs per admin
  const logs = adminLogs.get(adminId);
  if (logs.length > 1000) {
    adminLogs.set(adminId, logs.slice(-1000));
  }
  
  return log;
};

// Track admin activity
const trackAdminActivity = (adminId, activityType) => {
  const date = new Date().toISOString().split('T')[0];
  const key = `${adminId}:${date}`;
  
  if (!adminActivity.has(key)) {
    adminActivity.set(key, {
      adminId,
      date,
      activities: {}
    });
  }
  
  const activity = adminActivity.get(key);
  activity.activities[activityType] = (activity.activities[activityType] || 0) + 1;
  adminActivity.set(key, activity);
};

// Check if IP is banned
const isIPBanned = (ip) => {
  return bannedIPs.has(ip);
};

// Get user by ID (mock)
const getUserById = async (userId) => {
  return {
    id: userId,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
};

// Update user (mock)
const updateUser = async (userId, updates) => {
  console.log(`[ADMIN] Updating user ${userId}:`, updates);
  return { id: userId, ...updates };
};

// Delete user (mock)
const deleteUser = async (userId) => {
  console.log(`[ADMIN] Deleting user ${userId}`);
  return { success: true };
};

// ============================================
// Dashboard Routes
// ============================================

/**
 * GET /api/admin/dashboard/stats
 * Get admin dashboard statistics
 */
router.get('/dashboard/stats', authenticateToken, isAdmin, adminLimiter, async (req, res) => {
  try {
    const adminId = req.user.id;
    logAdminAction(adminId, 'view_dashboard_stats');
    
    // Mock statistics
    const stats = {
      users: {
        total: 15234,
        newToday: 234,
        newThisWeek: 1567,
        newThisMonth: 3456,
        activeToday: 3421,
        activeThisWeek: 8923,
        premium: 3456,
        premiumPercentage: 22.7
      },
      revenue: {
        today: 12450,
        thisWeek: 87650,
        thisMonth: 234567,
        thisYear: 1234567,
        mrr: 45678.50,
        arpu: 3.45,
        ltv: 124.50
      },
      engagement: {
        totalSessions: 45678,
        totalMinutes: 892345,
        averageSessionMinutes: 19.5,
        retentionDay1: 68,
        retentionDay7: 45,
        retentionDay30: 32
      },
      content: {
        totalLessons: 245,
        totalCourses: 12,
        totalVocabulary: 5234,
        averageRating: 4.7
      },
      support: {
        openTickets: 23,
        avgResponseTime: 45,
        satisfactionScore: 4.5,
        resolvedToday: 12
      },
      system: {
        cpuUsage: systemHealth.get('cpu_usage'),
        memoryUsage: systemHealth.get('memory_usage'),
        diskUsage: systemHealth.get('disk_usage'),
        uptime: systemHealth.get('uptime'),
        responseTime: systemHealth.get('response_time'),
        errorRate: systemHealth.get('error_rate')
      }
    };
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard statistics'
    });
  }
});

/**
 * GET /api/admin/dashboard/charts
 * Get chart data for dashboard
 */
router.get('/dashboard/charts', authenticateToken, isAdmin, adminLimiter, async (req, res) => {
  try {
    const { period = '30d', metric = 'users' } = req.query;
    
    let days = 30;
    if (period === '7d') days = 7;
    if (period === '90d') days = 90;
    if (period === '1y') days = 365;
    
    // Generate mock chart data
    const labels = [];
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toISOString().split('T')[0]);
      
      if (metric === 'users') {
        data.push(Math.floor(Math.random() * 500) + 100);
      } else if (metric === 'revenue') {
        data.push(Math.floor(Math.random() * 5000) + 1000);
      } else if (metric === 'sessions') {
        data.push(Math.floor(Math.random() * 1000) + 200);
      } else {
        data.push(Math.floor(Math.random() * 100) + 50);
      }
    }
    
    res.json({
      success: true,
      data: {
        labels,
        datasets: [
          {
            label: metric.charAt(0).toUpperCase() + metric.slice(1),
            data,
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)'
          }
        ],
        summary: {
          total: data.reduce((a, b) => a + b, 0),
          average: data.reduce((a, b) => a + b, 0) / data.length,
          max: Math.max(...data),
          min: Math.min(...data),
          trend: ((data[data.length - 1] - data[0]) / data[0]) * 100
        }
      }
    });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chart data'
    });
  }
});

// ============================================
// User Management Routes
// ============================================

/**
 * GET /api/admin/users
 * Get all users with filtering and pagination
 */
router.get('/users', authenticateToken, isAdmin, adminLimiter, async (req, res) => {
  try {
    const { 
      search, 
      role, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      page = 1, 
      limit = 20 
    } = req.query;
    
    // Mock users data
    let users = [];
    for (let i = 1; i <= 100; i++) {
      users.push({
        id: `user_${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: i <= 10 ? 'premium' : 'user',
        status: 'active',
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        lastLogin: new Date(Date.now() - i * 3600000).toISOString(),
        totalSessions: Math.floor(Math.random() * 100),
        totalXP: Math.floor(Math.random() * 5000),
        subscriptionPlan: i <= 10 ? 'pro' : 'free'
      });
    }
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(u => 
        u.email.toLowerCase().includes(searchLower) ||
        u.name.toLowerCase().includes(searchLower)
      );
    }
    
    if (role) {
      users = users.filter(u => u.role === role);
    }
    
    if (status) {
      users = users.filter(u => u.status === status);
    }
    
    // Apply sorting
    users.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'lastLogin') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedUsers = users.slice(startIndex, startIndex + limit);
    
    res.json({
      success: true,
      data: {
        users: paginatedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: users.length,
          pages: Math.ceil(users.length / limit)
        },
        filters: {
          search: search || null,
          role: role || null,
          status: status || null
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
});

/**
 * GET /api/admin/users/:userId
 * Get user details by ID
 */
router.get('/users/:userId', authenticateToken, isAdmin, adminLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    
    logAdminAction(adminId, 'view_user', { userId });
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Add additional user details
    const userDetails = {
      ...user,
      stats: {
        totalSessions: 127,
        totalMinutes: 3810,
        averageScore: 85,
        currentStreak: 7,
        totalXP: 12500,
        level: 15,
        badges: 12
      },
      subscription: {
        plan: 'pro',
        status: 'active',
        startDate: new Date('2024-01-15').toISOString(),
        endDate: new Date('2025-01-15').toISOString(),
        autoRenew: true
      },
      activity: {
        lastActive: new Date().toISOString(),
        deviceInfo: 'Chrome on Windows',
        ipAddress: '192.168.1.1'
      }
    };
    
    res.json({
      success: true,
      data: userDetails
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user details'
    });
  }
});

/**
 * PUT /api/admin/users/:userId
 * Update user
 */
router.put('/users/:userId', authenticateToken, isAdmin, updateUserValidation, async (req, res) => {
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
    const updates = req.body;
    const adminId = req.user.id;
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Cannot change super admin role
    if (user.role === 'super_admin' && updates.role && updates.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot change super admin role',
        code: 'CANNOT_CHANGE_SUPER_ADMIN'
      });
    }
    
    const updatedUser = await updateUser(userId, updates);
    
    logAdminAction(adminId, 'update_user', { userId, updates });
    trackAdminActivity(adminId, 'user_update');
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete user
 */
router.delete('/users/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Cannot delete super admin
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete super admin user',
        code: 'CANNOT_DELETE_SUPER_ADMIN'
      });
    }
    
    await deleteUser(userId);
    
    logAdminAction(adminId, 'delete_user', { userId });
    trackAdminActivity(adminId, 'user_delete');
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

/**
 * POST /api/admin/users/:userId/suspend
 * Suspend user account
 */
router.post('/users/:userId/suspend', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration = '30d' } = req.body;
    const adminId = req.user.id;
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    await updateUser(userId, {
      status: 'suspended',
      suspensionReason: reason || 'Violation of terms',
      suspensionDuration: duration,
      suspendedAt: new Date().toISOString(),
      suspendedBy: adminId
    });
    
    logAdminAction(adminId, 'suspend_user', { userId, reason, duration });
    trackAdminActivity(adminId, 'user_suspend');
    
    res.json({
      success: true,
      message: 'User suspended successfully',
      data: { userId, status: 'suspended' }
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suspend user'
    });
  }
});

/**
 * POST /api/admin/users/:userId/activate
 * Activate user account
 */
router.post('/users/:userId/activate', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    await updateUser(userId, {
      status: 'active',
      activatedAt: new Date().toISOString(),
      activatedBy: adminId
    });
    
    logAdminAction(adminId, 'activate_user', { userId });
    trackAdminActivity(adminId, 'user_activate');
    
    res.json({
      success: true,
      message: 'User activated successfully',
      data: { userId, status: 'active' }
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate user'
    });
  }
});

// ============================================
// Admin Management Routes (Super Admin only)
// ============================================

/**
 * GET /api/admin/admins
 * Get all admin users
 */
router.get('/admins', authenticateToken, isSuperAdmin, adminLimiter, async (req, res) => {
  try {
    res.json({
      success: true,
      data: adminUsers
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin users'
    });
  }
});

/**
 * POST /api/admin/admins
 * Create new admin user
 */
router.post('/admins', authenticateToken, isSuperAdmin, createAdminValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { email, name, role } = req.body;
    const adminId = req.user.id;
    
    // Check if email already exists
    if (adminUsers.some(a => a.email === email)) {
      return res.status(409).json({
        success: false,
        error: 'Admin user already exists with this email',
        code: 'ADMIN_EXISTS'
      });
    }
    
    const newAdmin = {
      id: generateId('admin'),
      email,
      name,
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: adminId,
      permissions: getPermissionsForRole(role)
    };
    
    adminUsers.push(newAdmin);
    
    logAdminAction(adminId, 'create_admin', { newAdminId: newAdmin.id, email, role });
    
    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: newAdmin
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin user'
    });
  }
});

/**
 * DELETE /api/admin/admins/:adminId
 * Delete admin user
 */
router.delete('/admins/:adminId', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { adminId } = req.params;
    const currentAdminId = req.user.id;
    
    const adminIndex = adminUsers.findIndex(a => a.id === adminId);
    
    if (adminIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }
    
    // Cannot delete yourself
    if (adminId === currentAdminId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own admin account',
        code: 'CANNOT_DELETE_SELF'
      });
    }
    
    const deletedAdmin = adminUsers[adminIndex];
    adminUsers.splice(adminIndex, 1);
    
    logAdminAction(currentAdminId, 'delete_admin', { deletedAdminId: adminId, email: deletedAdmin.email });
    
    res.json({
      success: true,
      message: 'Admin user deleted successfully'
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete admin user'
    });
  }
});

// Helper function for permissions
const getPermissionsForRole = (role) => {
  const permissions = {
    moderator: ['users.read', 'content.moderate'],
    support: ['users.read', 'tickets.manage'],
    admin: ['users.read', 'users.update', 'content.manage', 'analytics.view', 'settings.read'],
    super_admin: ['*']
  };
  return permissions[role] || [];
};

// ============================================
// System Settings Routes
// ============================================

/**
 * GET /api/admin/settings
 * Get all system settings
 */
router.get('/settings', authenticateToken, isAdmin, adminLimiter, async (req, res) => {
  try {
    const { category } = req.query;
    
    let settings = Array.from(systemSettings.values());
    
    if (category) {
      settings = settings.filter(s => s.category === category);
    }
    
    // Group by category
    const groupedSettings = {};
    settings.forEach(setting => {
      if (!groupedSettings[setting.category]) {
        groupedSettings[setting.category] = [];
      }
      groupedSettings[setting.category].push(setting);
    });
    
    res.json({
      success: true,
      data: groupedSettings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings'
    });
  }
});

/**
 * PUT /api/admin/settings
 * Update system setting
 */
router.put('/settings', authenticateToken, isAdmin, systemSettingsValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { key, value } = req.body;
    const adminId = req.user.id;
    
    const setting = systemSettings.get(key);
    
    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found',
        code: 'SETTING_NOT_FOUND'
      });
    }
    
    const oldValue = setting.value;
    setting.value = value;
    setting.updatedAt = new Date().toISOString();
    setting.updatedBy = adminId;
    
    systemSettings.set(key, setting);
    
    logAdminAction(adminId, 'update_setting', { key, oldValue, newValue: value });
    
    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: setting
    });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update setting'
    });
  }
});

// ============================================
// Audit Logs Routes
// ============================================

/**
 * GET /api/admin/audit-logs
 * Get admin audit logs
 */
router.get('/audit-logs', authenticateToken, isAdmin, adminLimiter, async (req, res) => {
  try {
    const { adminId, action, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    let logs = [];
    
    if (adminId) {
      logs = adminLogs.get(adminId) || [];
    } else {
      // Combine all logs
      for (const [_, adminLogsArray] of adminLogs.entries()) {
        logs.push(...adminLogsArray);
      }
    }
    
    // Apply filters
    if (action) {
      logs = logs.filter(l => l.action === action);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      logs = logs.filter(l => new Date(l.timestamp) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      logs = logs.filter(l => new Date(l.timestamp) <= end);
    }
    
    // Sort by timestamp desc
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedLogs = logs.slice(startIndex, startIndex + limit);
    
    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: logs.length,
          pages: Math.ceil(logs.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs'
    });
  }
});

/**
 * GET /api/admin/audit-logs/actions
 * Get available audit actions
 */
router.get('/audit-logs/actions', authenticateToken, isAdmin, async (req, res) => {
  try {
    const actions = [
      'view_dashboard_stats',
      'view_user',
      'update_user',
      'delete_user',
      'suspend_user',
      'activate_user',
      'create_admin',
      'delete_admin',
      'update_setting',
      'export_data',
      'import_data',
      'system_backup',
      'system_restore',
      'clear_cache'
    ];
    
    res.json({
      success: true,
      data: actions
    });
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve actions'
    });
  }
});

// ============================================
// System Health Routes
// ============================================

/**
 * GET /api/admin/health
 * Get system health metrics
 */
router.get('/health', authenticateToken, isAdmin, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        cpu: systemHealth.get('cpu_usage'),
        memory: systemHealth.get('memory_usage'),
        disk: systemHealth.get('disk_usage'),
        activeUsers: systemHealth.get('active_users'),
        activeSessions: systemHealth.get('active_sessions'),
        apiRequestsPerMinute: systemHealth.get('api_requests_per_minute'),
        errorRate: systemHealth.get('error_rate'),
        responseTime: systemHealth.get('response_time'),
        uptime: systemHealth.get('uptime')
      },
      services: {
        database: 'healthy',
        redis: 'healthy',
        api: 'healthy',
        websocket: 'healthy'
      }
    };
    
    // Determine overall status
    if (health.metrics.errorRate > 5 || health.metrics.responseTime > 1000) {
      health.status = 'degraded';
    } else if (health.metrics.errorRate > 10 || health.metrics.responseTime > 2000) {
      health.status = 'unhealthy';
    }
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system health'
    });
  }
});

/**
 * POST /api/admin/health/clear-cache
 * Clear system cache
 */
router.post('/health/clear-cache', authenticateToken, isAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;
    
    // In production, implement actual cache clearing
    console.log(`[ADMIN] Cache cleared by ${adminId}`);
    
    logAdminAction(adminId, 'clear_cache');
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

// ============================================
// Data Export Routes
// ============================================

/**
 * POST /api/admin/export/users
 * Export user data
 */
router.post('/export/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { format = 'json', filters = {} } = req.body;
    const adminId = req.user.id;
    
    logAdminAction(adminId, 'export_data', { type: 'users', format, filters });
    
    // Mock export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: adminId,
      totalRecords: 15234,
      data: [
        { id: 1, email: 'user1@example.com', name: 'User 1', created: '2024-01-01' },
        { id: 2, email: 'user2@example.com', name: 'User 2', created: '2024-01-02' }
      ]
    };
    
    res.json({
      success: true,
      message: 'Export completed',
      data: {
        downloadUrl: `/api/admin/export/download/export_${Date.now()}.${format}`,
        expiresIn: 3600,
        fileSize: '1.2 MB'
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data'
    });
  }
});

// ============================================
// Security Routes
// ============================================

/**
 * GET /api/admin/security/banned-ips
 * Get banned IPs
 */
router.get('/security/banned-ips', authenticateToken, isAdmin, async (req, res) => {
  try {
    const bannedList = Array.from(bannedIPs).map(ip => ({
      ip,
      bannedAt: new Date().toISOString(),
      reason: 'Violation detected'
    }));
    
    res.json({
      success: true,
      data: bannedList
    });
  } catch (error) {
    console.error('Get banned IPs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve banned IPs'
    });
  }
});

/**
 * POST /api/admin/security/ban-ip
 * Ban IP address
 */
router.post('/security/ban-ip', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { ip, reason } = req.body;
    const adminId = req.user.id;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required'
      });
    }
    
    bannedIPs.add(ip);
    
    logAdminAction(adminId, 'ban_ip', { ip, reason });
    
    res.json({
      success: true,
      message: `IP ${ip} banned successfully`
    });
  } catch (error) {
    console.error('Ban IP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ban IP'
    });
  }
});

/**
 * DELETE /api/admin/security/ban-ip/:ip
 * Unban IP address
 */
router.delete('/security/ban-ip/:ip', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { ip } = req.params;
    const adminId = req.user.id;
    
    bannedIPs.delete(ip);
    
    logAdminAction(adminId, 'unban_ip', { ip });
    
    res.json({
      success: true,
      message: `IP ${ip} unbanned successfully`
    });
  } catch (error) {
    console.error('Unban IP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unban IP'
    });
  }
});

module.exports = router;
