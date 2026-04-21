// ============================================
// Authentication Middleware
// SpeakFlow - AI Language Learning Platform
// ============================================

const jwt = require('jsonwebtoken');
const { promisify } = require('util');

// ============================================
// Constants & Configuration
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'speakflow-super-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'speakflow-refresh-secret-key';
const TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '7d';

// Mock user cache (in production, use Redis or database)
const userCache = new Map();
const tokenBlacklist = new Set();

// ============================================
// Helper Functions
// ============================================

/**
 * Verify JWT token
 */
const verifyToken = async (token, secret = JWT_SECRET) => {
  try {
    const decoded = await promisify(jwt.verify)(token, secret);
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Check if token is blacklisted
 */
const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

/**
 * Add token to blacklist
 */
const blacklistToken = (token, expiry = 86400) => {
  tokenBlacklist.add(token);
  // Auto-remove after expiry
  setTimeout(() => {
    tokenBlacklist.delete(token);
  }, expiry * 1000);
};

/**
 * Get user from cache or database (mock)
 */
const getUserById = async (userId) => {
  if (userCache.has(userId)) {
    return userCache.get(userId);
  }
  
  // Mock user data - in production, fetch from database
  const mockUser = {
    id: userId,
    email: `user${userId}@example.com`,
    name: `User ${userId}`,
    role: 'user',
    status: 'active',
    isEmailVerified: true,
    createdAt: new Date().toISOString()
  };
  
  userCache.set(userId, mockUser);
  return mockUser;
};

/**
 * Check user permissions
 */
const hasPermission = (userRole, requiredPermission) => {
  const rolePermissions = {
    user: ['read:own', 'write:own'],
    premium: ['read:own', 'write:own', 'read:premium', 'write:premium'],
    moderator: ['read:all', 'write:own', 'moderate:content'],
    support: ['read:all', 'write:support', 'manage:tickets'],
    admin: ['read:all', 'write:all', 'manage:users', 'manage:content', 'view:analytics'],
    super_admin: ['*']
  };
  
  const permissions = rolePermissions[userRole] || rolePermissions.user;
  return permissions.includes('*') || permissions.includes(requiredPermission);
};

// ============================================
// Main Authentication Middleware
// ============================================

/**
 * Authenticate JWT token
 * Verifies the token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }
    
    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        error: 'Token has been invalidated. Please login again.',
        code: 'TOKEN_BLACKLISTED'
      });
    }
    
    // Verify token
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Get user from database
    const user = await getUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found.',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: `Account is ${user.status}. Please contact support.`,
        code: 'ACCOUNT_' + user.status.toUpperCase()
      });
    }
    
    // Check if email is verified (optional - can be skipped for testing)
    if (!user.isEmailVerified && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before accessing this resource.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status
    };
    
    // Attach token for potential refresh
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during authentication',
      code: 'AUTH_ERROR'
    });
  }
};

// ============================================
// Optional Authentication Middleware
// ============================================

/**
 * Optional authentication - doesn't fail if no token
 * Attaches user if token is valid, otherwise continues
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token && !isTokenBlacklisted(token)) {
      const decoded = await verifyToken(token);
      if (decoded) {
        const user = await getUserById(decoded.id);
        if (user && user.status === 'active') {
          req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          };
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue even if optional auth fails
    next();
  }
};

// ============================================
// Role-Based Authorization Middleware
// ============================================

/**
 * Require specific role
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}`,
        code: 'INSUFFICIENT_ROLE'
      });
    }
    
    next();
  };
};

/**
 * Require specific permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required permission: ${permission}`,
        code: 'INSUFFICIENT_PERMISSION'
      });
    }
    
    next();
  };
};

/**
 * Admin only middleware
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  
  next();
};

/**
 * Super admin only middleware
 */
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }
  
  next();
};

/**
 * Owner or admin middleware
 * Checks if user is the owner of the resource or an admin
 */
const isOwnerOrAdmin = (getResourceUserId) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Admin has full access
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }
    
    // Get resource owner ID
    let resourceUserId;
    if (typeof getResourceUserId === 'function') {
      resourceUserId = await getResourceUserId(req);
    } else {
      resourceUserId = req.params.userId || req.params.id;
    }
    
    // Check if user is the owner
    if (req.user.id !== resourceUserId) {
      return res.status(403).json({
        success: false,
        error: 'You can only access your own resources',
        code: 'NOT_OWNER'
      });
    }
    
    next();
  };
};

// ============================================
// Resource Access Middleware
// ============================================

/**
 * Check if user can access a specific user's data
 */
const canAccessUser = (req, res, next) => {
  const targetUserId = req.params.userId || req.params.id;
  
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // User can access their own data
  if (req.user.id === targetUserId) {
    return next();
  }
  
  // Admin can access any user data
  if (req.user.role === 'admin' || req.user.role === 'super_admin') {
    return next();
  }
  
  // Support can access user data
  if (req.user.role === 'support') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: 'Access denied',
    code: 'ACCESS_DENIED'
  });
};

// ============================================
// Rate Limiting Middleware (per user)
// ============================================

const userRateLimits = new Map();

/**
 * Rate limit based on user ID
 */
const rateLimitByUser = (maxRequests, windowMs) => {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const key = `${userId}:${req.path}`;
    const now = Date.now();
    
    if (!userRateLimits.has(key)) {
      userRateLimits.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    const record = userRateLimits.get(key);
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      userRateLimits.set(key, record);
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: `Too many requests. Please try again in ${Math.ceil((record.resetTime - now) / 1000)} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    
    record.count++;
    userRateLimits.set(key, record);
    next();
  };
};

// ============================================
// Session Management Middleware
// ============================================

/**
 * Validate session (check if session is still valid)
 */
const validateSession = async (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    return next();
  }
  
  // In production, check session in Redis/database
  // For now, just pass through
  
  next();
};

/**
 * Refresh token middleware
 */
const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }
    
    const decoded = await verifyToken(refreshToken, JWT_REFRESH_SECRET);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    const user = await getUserById(decoded.id);
    
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
        code: 'USER_INVALID'
      });
    }
    
    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    
    req.newAccessToken = newAccessToken;
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
      code: 'REFRESH_FAILED'
    });
  }
};

// ============================================
// Logging & Audit Middleware
// ============================================

/**
 * Log user action for audit
 */
const auditLog = (action) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Store original send function
    const originalSend = res.json;
    
    res.json = function(data) {
      const duration = Date.now() - startTime;
      
      // Log action (in production, save to database)
      if (req.user) {
        console.log(`[AUDIT] User: ${req.user.id} (${req.user.role}) | Action: ${action} | Path: ${req.path} | Status: ${res.statusCode} | Duration: ${duration}ms`);
      }
      
      // Call original send
      originalSend.call(this, data);
    };
    
    next();
  };
};

// ============================================
// Security Headers Middleware
// ============================================

/**
 * Add security headers to response
 */
const securityHeaders = (req, res, next) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  
  // Set CSP in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://api.openai.com https://api.stripe.com;"
    );
  }
  
  next();
};

// ============================================
// CSRF Protection Middleware
// ============================================

/**
 * CSRF token validation (for state-changing requests)
 */
const csrfProtection = (req, res, next) => {
  // Skip for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const csrfToken = req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;
  
  if (!csrfToken || csrfToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
  }
  
  next();
};

// ============================================
// API Key Authentication (for external services)
// ============================================

/**
 * API Key authentication for external API calls
 */
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    });
  }
  
  // In production, validate API key against database
  const validApiKeys = process.env.API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }
  
  next();
};

// ============================================
// Device & Location Middleware
// ============================================

/**
 * Extract device information from request
 */
const extractDeviceInfo = (req, res, next) => {
  const userAgent = req.headers['user-agent'];
  const ip = req.ip || req.connection.remoteAddress;
  const acceptLanguage = req.headers['accept-language'];
  
  req.deviceInfo = {
    userAgent,
    ip,
    acceptLanguage,
    timestamp: new Date().toISOString()
  };
  
  // Simple device type detection
  if (userAgent) {
    if (/mobile/i.test(userAgent)) {
      req.deviceInfo.type = 'mobile';
    } else if (/tablet/i.test(userAgent)) {
      req.deviceInfo.type = 'tablet';
    } else {
      req.deviceInfo.type = 'desktop';
    }
    
    if (/Chrome/i.test(userAgent)) req.deviceInfo.browser = 'chrome';
    else if (/Firefox/i.test(userAgent)) req.deviceInfo.browser = 'firefox';
    else if (/Safari/i.test(userAgent)) req.deviceInfo.browser = 'safari';
    else if (/Edge/i.test(userAgent)) req.deviceInfo.browser = 'edge';
    else req.deviceInfo.browser = 'other';
  }
  
  next();
};

// ============================================
// Export Middleware
// ============================================

module.exports = {
  // Main authentication
  authenticate,
  optionalAuth,
  
  // Role-based authorization
  requireRole,
  requirePermission,
  isAdmin,
  isSuperAdmin,
  isOwnerOrAdmin,
  canAccessUser,
  
  // Rate limiting
  rateLimitByUser,
  
  // Session management
  validateSession,
  refreshToken,
  
  // Logging
  auditLog,
  
  // Security
  securityHeaders,
  csrfProtection,
  
  // External auth
  authenticateApiKey,
  
  // Utilities
  extractDeviceInfo,
  blacklistToken,
  verifyToken
};
