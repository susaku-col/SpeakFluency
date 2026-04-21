// ============================================
// Admin Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  SUPPORT: 'support',
  ANALYST: 'analyst'
};

const PERMISSIONS = {
  // User management
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_SUSPEND: 'users.suspend',
  
  // Content management
  CONTENT_READ: 'content.read',
  CONTENT_CREATE: 'content.create',
  CONTENT_UPDATE: 'content.update',
  CONTENT_DELETE: 'content.delete',
  CONTENT_MODERATE: 'content.moderate',
  
  // Analytics
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_EXPORT: 'analytics.export',
  
  // System settings
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',
  
  // Support
  SUPPORT_VIEW: 'support.view',
  SUPPORT_MANAGE: 'support.manage',
  
  // Admin management
  ADMINS_READ: 'admins.read',
  ADMINS_CREATE: 'admins.create',
  ADMINS_UPDATE: 'admins.update',
  ADMINS_DELETE: 'admins.delete',
  
  // System
  SYSTEM_HEALTH: 'system.health',
  SYSTEM_BACKUP: 'system.backup',
  SYSTEM_RESTORE: 'system.restore',
  SYSTEM_CLEAR_CACHE: 'system.clear_cache'
};

const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ADMIN_ROLES.ADMIN]: [
    PERMISSIONS.USERS_READ, PERMISSIONS.USERS_UPDATE, PERMISSIONS.USERS_SUSPEND,
    PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_UPDATE, PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.SUPPORT_VIEW, PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.SYSTEM_HEALTH, PERMISSIONS.SYSTEM_CLEAR_CACHE
  ],
  [ADMIN_ROLES.MODERATOR]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_MODERATE,
    PERMISSIONS.SUPPORT_VIEW
  ],
  [ADMIN_ROLES.SUPPORT]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.SUPPORT_VIEW, PERMISSIONS.SUPPORT_MANAGE
  ],
  [ADMIN_ROLES.ANALYST]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_EXPORT
  ]
};

// ============================================
// Mock Database
// ============================================

// Admin users storage
const adminUsers = new Map();

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

// Backup history
const backupHistory = new Map();

// System notifications
const systemNotifications = new Map();

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique ID
 */
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if user has permission
 */
const hasPermission = (userRole, permission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission) || permissions.includes('*');
};

/**
 * Log admin action
 */
const logAdminAction = (adminId, action, details = {}, ip = null, userAgent = null) => {
  const logId = generateId('log');
  const log = {
    id: logId,
    adminId,
    action,
    details,
    ip,
    userAgent,
    timestamp: new Date().toISOString()
  };
  
  if (!adminLogs.has(adminId)) {
    adminLogs.set(adminId, []);
  }
  
  const logs = adminLogs.get(adminId);
  logs.push(log);
  
  // Keep only last 1000 logs per admin
  if (logs.length > 1000) {
    adminLogs.set(adminId, logs.slice(-1000));
  }
  
  return log;
};

/**
 * Track admin activity
 */
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

/**
 * Get admin user by ID
 */
const getAdminById = (adminId) => {
  return adminUsers.get(adminId) || null;
};

/**
 * Get admin user by email
 */
const getAdminByEmail = (email) => {
  for (const admin of adminUsers.values()) {
    if (admin.email === email) {
      return admin;
    }
  }
  return null;
};

/**
 * Create admin user
 */
const createAdmin = (adminData) => {
  const adminId = generateId('admin');
  const admin = {
    id: adminId,
    ...adminData,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    lastIp: null
  };
  adminUsers.set(adminId, admin);
  return admin;
};

/**
 * Update admin user
 */
const updateAdmin = (adminId, updates) => {
  const admin = adminUsers.get(adminId);
  if (!admin) return null;
  
  const updatedAdmin = {
    ...admin,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  adminUsers.set(adminId, updatedAdmin);
  return updatedAdmin;
};

/**
 * Delete admin user
 */
const deleteAdmin = (adminId) => {
  return adminUsers.delete(adminId);
};

/**
 * Check if IP is banned
 */
const isIPBanned = (ip) => {
  return bannedIPs.has(ip);
};

/**
 * Add banned IP
 */
const addBannedIP = (ip, reason, adminId) => {
  bannedIPs.add(ip);
  logAdminAction(adminId, 'ban_ip', { ip, reason });
};

/**
 * Remove banned IP
 */
const removeBannedIP = (ip, adminId) => {
  bannedIPs.delete(ip);
  logAdminAction(adminId, 'unban_ip', { ip });
};

/**
 * Update system health metrics
 */
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
  systemHealth.set('last_updated', new Date().toISOString());
};

// Initialize system health
updateSystemHealth();
setInterval(updateSystemHealth, 60000); // Update every minute

// ============================================
// Default Data Initialization
// ============================================

// Default system settings
const defaultSettings = [
  { key: 'site_name', value: 'SpeakFlow', category: 'general', type: 'string', description: 'Website name' },
  { key: 'site_description', value: 'AI-Powered Language Learning Platform', category: 'general', type: 'string', description: 'Website description' },
  { key: 'site_logo', value: '/images/logo.svg', category: 'general', type: 'string', description: 'Site logo URL' },
  { key: 'contact_email', value: 'support@speakflow.com', category: 'general', type: 'email', description: 'Support email address' },
  
  { key: 'maintenance_mode', value: false, category: 'system', type: 'boolean', description: 'Enable maintenance mode' },
  { key: 'maintenance_message', value: 'We are currently performing maintenance. Please check back soon.', category: 'system', type: 'string', description: 'Maintenance mode message' },
  { key: 'registration_enabled', value: true, category: 'system', type: 'boolean', description: 'Allow new user registration' },
  { key: 'email_verification', value: true, category: 'system', type: 'boolean', description: 'Require email verification' },
  
  { key: 'max_login_attempts', value: 5, category: 'security', type: 'number', description: 'Maximum login attempts before lockout' },
  { key: 'session_timeout', value: 86400, category: 'security', type: 'number', description: 'Session timeout in seconds' },
  { key: 'password_min_length', value: 6, category: 'security', type: 'number', description: 'Minimum password length' },
  { key: 'two_factor_auth', value: false, category: 'security', type: 'boolean', description: 'Require two-factor authentication for admins' },
  
  { key: 'default_language', value: 'en', category: 'localization', type: 'string', description: 'Default site language' },
  { key: 'supported_languages', value: ['en', 'es', 'fr', 'ja', 'ko'], category: 'localization', type: 'array', description: 'Supported languages' },
  
  { key: 'free_lessons_per_day', value: 3, category: 'subscription', type: 'number', description: 'Free tier daily lesson limit' },
  { key: 'referral_bonus', value: 50, category: 'subscription', type: 'number', description: 'Referral bonus XP' },
  
  { key: 'analytics_enabled', value: true, category: 'analytics', type: 'boolean', description: 'Enable analytics tracking' },
  { key: 'analytics_retention_days', value: 90, category: 'analytics', type: 'number', description: 'Analytics data retention in days' },
  
  { key: 'cache_ttl', value: 3600, category: 'performance', type: 'number', description: 'Cache TTL in seconds' },
  { key: 'max_upload_size', value: 10, category: 'performance', type: 'number', description: 'Maximum upload size in MB' }
];

defaultSettings.forEach(setting => {
  systemSettings.set(setting.key, setting);
});

// Default admin users
const defaultAdmins = [
  {
    id: 'super_admin_1',
    email: 'superadmin@speakflow.com',
    name: 'Super Admin',
    role: ADMIN_ROLES.SUPER_ADMIN,
    status: 'active',
    permissions: ROLE_PERMISSIONS[ADMIN_ROLES.SUPER_ADMIN],
    createdAt: new Date('2024-01-01').toISOString(),
    lastLogin: new Date().toISOString(),
    lastIp: '192.168.1.1'
  },
  {
    id: 'admin_1',
    email: 'admin@speakflow.com',
    name: 'Admin User',
    role: ADMIN_ROLES.ADMIN,
    status: 'active',
    permissions: ROLE_PERMISSIONS[ADMIN_ROLES.ADMIN],
    createdAt: new Date('2024-01-01').toISOString(),
    lastLogin: new Date().toISOString(),
    lastIp: '192.168.1.2'
  },
  {
    id: 'moderator_1',
    email: 'moderator@speakflow.com',
    name: 'Moderator',
    role: ADMIN_ROLES.MODERATOR,
    status: 'active',
    permissions: ROLE_PERMISSIONS[ADMIN_ROLES.MODERATOR],
    createdAt: new Date('2024-01-01').toISOString(),
    lastLogin: new Date().toISOString(),
    lastIp: '192.168.1.3'
  }
];

defaultAdmins.forEach(admin => {
  adminUsers.set(admin.id, admin);
});

// ============================================
// Dashboard Controller Methods
// ============================================

/**
 * Get admin dashboard statistics
 * GET /api/admin/dashboard/stats
 */
exports.getDashboardStats = async (req, res) => {
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
        activeThisMonth: 12456,
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
        ltv: 124.50,
        churnRate: 4.2
      },
      engagement: {
        totalSessions: 45678,
        totalMinutes: 892345,
        averageSessionMinutes: 19.5,
        averageScore: 76.5,
        retentionDay1: 68,
        retentionDay7: 45,
        retentionDay30: 32
      },
      content: {
        totalLessons: 245,
        totalCourses: 12,
        totalVocabulary: 5234,
        averageRating: 4.7,
        mostPopularLesson: 'Basic Greetings'
      },
      support: {
        openTickets: 23,
        avgResponseTime: 45,
        satisfactionScore: 4.5,
        resolvedToday: 12,
        unresolved: 45
      },
      system: {
        cpuUsage: systemHealth.get('cpu_usage'),
        memoryUsage: systemHealth.get('memory_usage'),
        diskUsage: systemHealth.get('disk_usage'),
        uptime: systemHealth.get('uptime'),
        responseTime: systemHealth.get('response_time'),
        errorRate: systemHealth.get('error_rate'),
        activeUsers: systemHealth.get('active_users'),
        apiRequests: systemHealth.get('api_requests_per_minute')
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
      error: 'Failed to retrieve dashboard statistics',
      code: 'DASHBOARD_STATS_FAILED'
    });
  }
};

/**
 * Get chart data for dashboard
 * GET /api/admin/dashboard/charts
 */
exports.getDashboardCharts = async (req, res) => {
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
      } else if (metric === 'conversion') {
        data.push(Math.floor(Math.random() * 20) + 5);
      } else {
        data.push(Math.floor(Math.random() * 100) + 50);
      }
    }
    
    // Calculate moving average
    const movingAverage = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - 6);
      const window = data.slice(start, i + 1);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      movingAverage.push(Math.round(avg));
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
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            fill: true
          },
          {
            label: '7-Day Average',
            data: movingAverage,
            borderColor: '#10B981',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            fill: false
          }
        ],
        summary: {
          total: data.reduce((a, b) => a + b, 0),
          average: Math.round(data.reduce((a, b) => a + b, 0) / data.length),
          max: Math.max(...data),
          min: Math.min(...data),
          trend: ((data[data.length - 1] - data[0]) / data[0]) * 100,
          trendDirection: data[data.length - 1] > data[0] ? 'up' : 'down'
        }
      }
    });
    
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chart data',
      code: 'CHART_DATA_FAILED'
    });
  }
};

// ============================================
// User Management Controller Methods
// ============================================

/**
 * Get all users (admin)
 * GET /api/admin/users
 */
exports.adminGetUsers = async (req, res) => {
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
        avatar: `https://ui-avatars.com/api/?name=User+${i}&background=4F46E5&color=fff`,
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
        lastLogin: new Date(Date.now() - i * 3600000).toISOString(),
        totalSessions: Math.floor(Math.random() * 100),
        totalXP: Math.floor(Math.random() * 5000),
        subscriptionPlan: i <= 10 ? 'pro' : 'free',
        subscriptionStatus: 'active',
        country: ['US', 'UK', 'CA', 'AU', 'ID'][Math.floor(Math.random() * 5)]
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
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
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
        },
        summary: {
          total: users.length,
          active: users.filter(u => u.status === 'active').length,
          premium: users.filter(u => u.role === 'premium').length,
          newToday: users.filter(u => new Date(u.createdAt).toDateString() === new Date().toDateString()).length
        }
      }
    });
    
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users',
      code: 'ADMIN_USERS_FAILED'
    });
  }
};

/**
 * Get user details (admin)
 * GET /api/admin/users/:userId
 */
exports.adminGetUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    
    logAdminAction(adminId, 'view_user', { userId });
    
    // Mock user details
    const user = {
      id: userId,
      email: `${userId}@example.com`,
      name: `User ${userId}`,
      role: 'user',
      status: 'active',
      avatar: `https://ui-avatars.com/api/?name=User+${userId}&background=4F46E5&color=fff`,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      lastLogin: new Date().toISOString(),
      emailVerified: true,
      phone: '+1234567890',
      country: 'US',
      timezone: 'America/New_York',
      language: 'en',
      stats: {
        totalSessions: 127,
        totalMinutes: 3810,
        averageScore: 85,
        currentStreak: 7,
        longestStreak: 21,
        totalXP: 12500,
        level: 15,
        badges: 12,
        pronunciationScore: 82,
        vocabularyScore: 88,
        grammarScore: 78,
        fluencyScore: 75
      },
      subscription: {
        plan: 'pro',
        status: 'active',
        startDate: new Date('2024-01-15').toISOString(),
        endDate: new Date('2025-01-15').toISOString(),
        autoRenew: true,
        paymentMethod: 'credit_card'
      },
      activity: {
        lastActive: new Date().toISOString(),
        deviceInfo: 'Chrome on Windows',
        ipAddress: '192.168.1.100',
        browser: 'Chrome 120.0',
        os: 'Windows 11'
      },
      notes: []
    };
    
    res.json({
      success: true,
      data: user
    });
    
  } catch (error) {
    console.error('Admin get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user details',
      code: 'ADMIN_USER_FAILED'
    });
  }
};

/**
 * Update user (admin)
 * PUT /api/admin/users/:userId
 */
exports.adminUpdateUser = async (req, res) => {
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
    
    // Mock update
    const updatedUser = {
      id: userId,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };
    
    logAdminAction(adminId, 'update_user', { userId, updates });
    trackAdminActivity(adminId, 'user_update');
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
    
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      code: 'ADMIN_UPDATE_USER_FAILED'
    });
  }
};

/**
 * Delete user (admin)
 * DELETE /api/admin/users/:userId
 */
exports.adminDeleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    
    logAdminAction(adminId, 'delete_user', { userId });
    trackAdminActivity(adminId, 'user_delete');
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      code: 'ADMIN_DELETE_USER_FAILED'
    });
  }
};

/**
 * Suspend user (admin)
 * POST /api/admin/users/:userId/suspend
 */
exports.adminSuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration = '30d' } = req.body;
    const adminId = req.user.id;
    
    logAdminAction(adminId, 'suspend_user', { userId, reason, duration });
    trackAdminActivity(adminId, 'user_suspend');
    
    res.json({
      success: true,
      message: 'User suspended successfully',
      data: { userId, status: 'suspended', reason, duration }
    });
    
  } catch (error) {
    console.error('Admin suspend user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to suspend user',
      code: 'ADMIN_SUSPEND_USER_FAILED'
    });
  }
};

/**
 * Activate user (admin)
 * POST /api/admin/users/:userId/activate
 */
exports.adminActivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    
    logAdminAction(adminId, 'activate_user', { userId });
    trackAdminActivity(adminId, 'user_activate');
    
    res.json({
      success: true,
      message: 'User activated successfully',
      data: { userId, status: 'active' }
    });
    
  } catch (error) {
    console.error('Admin activate user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate user',
      code: 'ADMIN_ACTIVATE_USER_FAILED'
    });
  }
};

// ============================================
// Admin Management Controller Methods
// ============================================

/**
 * Get all admin users (super admin only)
 * GET /api/admin/admins
 */
exports.adminGetAdmins = async (req, res) => {
  try {
    const admins = Array.from(adminUsers.values());
    
    res.json({
      success: true,
      data: admins.map(admin => ({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: admin.status,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Admin get admins error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin users',
      code: 'ADMIN_GET_ADMINS_FAILED'
    });
  }
};

/**
 * Create admin user (super admin only)
 * POST /api/admin/admins
 */
exports.adminCreateAdmin = async (req, res) => {
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
    if (getAdminByEmail(email)) {
      return res.status(409).json({
        success: false,
        error: 'Admin user already exists with this email',
        code: 'ADMIN_EXISTS'
      });
    }
    
    const newAdmin = createAdmin({
      email,
      name,
      role,
      permissions: ROLE_PERMISSIONS[role] || []
    });
    
    logAdminAction(adminId, 'create_admin', { newAdminId: newAdmin.id, email, role });
    trackAdminActivity(adminId, 'admin_create');
    
    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
        createdAt: newAdmin.createdAt
      }
    });
    
  } catch (error) {
    console.error('Admin create admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin user',
      code: 'ADMIN_CREATE_ADMIN_FAILED'
    });
  }
};

/**
 * Update admin user (super admin only)
 * PUT /api/admin/admins/:adminId
 */
exports.adminUpdateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const updates = req.body;
    const currentAdminId = req.user.id;
    
    const admin = getAdminById(adminId);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin user not found',
        code: 'ADMIN_NOT_FOUND'
      });
    }
    
    // Cannot change super admin role
    if (admin.role === ADMIN_ROLES.SUPER_ADMIN && updates.role && updates.role !== ADMIN_ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Cannot change super admin role',
        code: 'CANNOT_CHANGE_SUPER_ADMIN'
      });
    }
    
    const updatedAdmin = updateAdmin(adminId, updates);
    
    logAdminAction(currentAdminId, 'update_admin', { adminId, updates });
    trackAdminActivity(currentAdminId, 'admin_update');
    
    res.json({
      success: true,
      message: 'Admin user updated successfully',
      data: updatedAdmin
    });
    
  } catch (error) {
    console.error('Admin update admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin user',
      code: 'ADMIN_UPDATE_ADMIN_FAILED'
    });
  }
};

/**
 * Delete admin user (super admin only)
 * DELETE /api/admin/admins/:adminId
 */
exports.adminDeleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const currentAdminId = req.user.id;
    
    const admin = getAdminById(adminId);
    
    if (!admin) {
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
    
    // Cannot delete super admin
    if (admin.role === ADMIN_ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete super admin user',
        code: 'CANNOT_DELETE_SUPER_ADMIN'
      });
    }
    
    deleteAdmin(adminId);
    
    logAdminAction(currentAdminId, 'delete_admin', { deletedAdminId: adminId, email: admin.email });
    trackAdminActivity(currentAdminId, 'admin_delete');
    
    res.json({
      success: true,
      message: 'Admin user deleted successfully'
    });
    
  } catch (error) {
    console.error('Admin delete admin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete admin user',
      code: 'ADMIN_DELETE_ADMIN_FAILED'
    });
  }
};

// ============================================
// System Settings Controller Methods
// ============================================

/**
 * Get system settings
 * GET /api/admin/settings
 */
exports.getSystemSettings = async (req, res) => {
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
      error: 'Failed to retrieve settings',
      code: 'SETTINGS_FAILED'
    });
  }
};

/**
 * Update system setting
 * PUT /api/admin/settings
 */
exports.updateSystemSetting = async (req, res) => {
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
      return res.status(404).json
