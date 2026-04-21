// ============================================
// Rate Limit Middleware
// SpeakFlow - AI Language Learning Platform
// ============================================

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

// ============================================
// Redis Configuration (Optional)
// ============================================

let redisClient = null;

// Initialize Redis if URL is provided
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('[RateLimit] Redis connection failed, falling back to memory store');
        return null;
      }
      return Math.min(times * 100, 3000);
    }
  });
  
  redisClient.on('error', (err) => {
    console.warn('[RateLimit] Redis error:', err.message);
    redisClient = null;
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get client IP address (considering proxies)
 */
const getClientIp = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         'unknown';
};

/**
 * Get user ID if authenticated
 */
const getUserId = (req) => {
  return req.user?.id || null;
};

/**
 * Generate rate limit key
 */
const generateKey = (req, prefix) => {
  const userId = getUserId(req);
  const ip = getClientIp(req);
  
  if (userId) {
    return `${prefix}:user:${userId}`;
  }
  return `${prefix}:ip:${ip}`;
};

/**
 * Skip rate limiting for whitelisted IPs
 */
const isWhitelisted = (req) => {
  const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
  const clientIp = getClientIp(req);
  return whitelist.includes(clientIp);
};

/**
 * Skip rate limiting for development
 */
const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
};

// ============================================
// Custom Rate Limit Handlers
// ============================================

/**
 * Standard rate limit handler
 */
const standardHandler = (req, res, next, options) => {
  const retryAfter = Math.ceil(options.windowMs / 1000);
  
  res.status(429).json({
    success: false,
    error: options.message || 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter,
    limit: options.max,
    windowMs: options.windowMs
  });
};

/**
 * Login rate limit handler (more specific)
 */
const loginHandler = (req, res) => {
  const retryAfter = 900; // 15 minutes
  
  res.status(429).json({
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
    retryAfter,
    message: 'Your account has been temporarily locked due to too many failed login attempts.'
  });
};

/**
 * Registration rate limit handler
 */
const registrationHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too many registration attempts. Please try again later.',
    code: 'REGISTRATION_RATE_LIMIT_EXCEEDED',
    retryAfter: 3600
  });
};

/**
 * API rate limit handler
 */
const apiHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'API rate limit exceeded. Please slow down your requests.',
    code: 'API_RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  });
};

// ============================================
// Rate Limit Configurations
// ============================================

/**
 * General rate limit for all requests
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  keyGenerator: (req) => generateKey(req, 'general'),
  skip: (req) => isWhitelisted(req) || isDevelopment(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Strict rate limit for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  statusCode: 429,
  keyGenerator: (req) => generateKey(req, 'auth'),
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Login rate limit (stricter)
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts, please try again after 15 minutes.',
  statusCode: 429,
  keyGenerator: (req) => {
    const email = req.body.email?.toLowerCase() || 'unknown';
    const ip = getClientIp(req);
    return `login:${email}:${ip}`;
  },
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: loginHandler
});

/**
 * Registration rate limit
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: 'Too many registration attempts, please try again later.',
  statusCode: 429,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    return `register:${ip}`;
  },
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: registrationHandler
});

/**
 * API rate limit (for external API calls)
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'API rate limit exceeded. Please slow down.',
  statusCode: 429,
  keyGenerator: (req) => {
    const apiKey = req.headers['x-api-key'] || 'anonymous';
    return `api:${apiKey}`;
  },
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: apiHandler
});

/**
 * Session creation rate limit
 */
const sessionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 sessions per minute
  message: 'Too many session requests. Please slow down.',
  statusCode: 429,
  keyGenerator: (req) => generateKey(req, 'session'),
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Payment rate limit
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 payment attempts per minute
  message: 'Too many payment attempts. Please try again later.',
  statusCode: 429,
  keyGenerator: (req) => generateKey(req, 'payment'),
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Email sending rate limit
 */
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 emails per hour
  message: 'Too many email requests. Please try again later.',
  statusCode: 429,
  keyGenerator: (req) => generateKey(req, 'email'),
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * File upload rate limit
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  message: 'Too many upload requests. Please slow down.',
  statusCode: 429,
  keyGenerator: (req) => generateKey(req, 'upload'),
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Search rate limit
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Too many search requests. Please slow down.',
  statusCode: 429,
  keyGenerator: (req) => generateKey(req, 'search'),
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Webhook rate limit (higher limit for webhooks)
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 webhook requests per minute
  message: 'Too many webhook requests.',
  statusCode: 429,
  keyGenerator: (req) => {
    const source = req.headers['x-webhook-source'] || 'unknown';
    return `webhook:${source}`;
  },
  skip: (req) => true, // Don't skip, but higher limit
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Admin rate limit (lower limit for admin actions)
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 admin requests per minute
  message: 'Too many admin requests. Please slow down.',
  statusCode: 429,
  keyGenerator: (req) => generateKey(req, 'admin'),
  skip: (req) => isWhitelisted(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

/**
 * Public endpoint rate limit (most lenient)
 */
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    return `public:${ip}`;
  },
  skip: (req) => isWhitelisted(req) || isDevelopment(),
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler
});

// ============================================
// Dynamic Rate Limiters
// ============================================

/**
 * Create a custom rate limiter with dynamic limits based on user role
 */
const createDynamicLimiter = (limits) => {
  return rateLimit({
    windowMs: limits.windowMs || 60 * 1000,
    max: (req) => {
      const userRole = req.user?.role || 'anonymous';
      return limits[userRole] || limits.default || 100;
    },
    message: limits.message || 'Too many requests, please try again later.',
    statusCode: 429,
    keyGenerator: (req) => generateKey(req, limits.prefix || 'dynamic'),
    skip: (req) => isWhitelisted(req),
    standardHeaders: true,
    legacyHeaders: false,
    handler: standardHandler
  });
};

/**
 * Create a rate limiter that increases limits for authenticated users
 */
const createAuthAwareLimiter = (anonymousLimit, authLimit, windowMs = 60000) => {
  return rateLimit({
    windowMs,
    max: (req) => {
      return req.user ? authLimit : anonymousLimit;
    },
    message: 'Too many requests, please try again later.',
    statusCode: 429,
    keyGenerator: (req) => generateKey(req, 'auth-aware'),
    skip: (req) => isWhitelisted(req),
    standardHeaders: true,
    legacyHeaders: false,
    handler: standardHandler
  });
};

// ============================================
// Redis Store Rate Limiter (if Redis available)
// ============================================

/**
 * Create Redis-based rate limiter (for production)
 */
const createRedisLimiter = (options = {}) => {
  if (!redisClient) {
    // Fallback to memory store if Redis not available
    console.warn('[RateLimit] Redis not available, using memory store');
    return rateLimit({
      windowMs: options.windowMs || 60 * 1000,
      max: options.max || 100,
      message: options.message || 'Too many requests, please try again later.',
      statusCode: 429,
      keyGenerator: options.keyGenerator || ((req) => generateKey(req, options.prefix || 'redis')),
      standardHeaders: true,
      legacyHeaders: false,
      handler: options.handler || standardHandler
    });
  }
  
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: `rl:${options.prefix || 'general'}:`,
      resetExpiryOnChange: true
    }),
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 100,
    message: options.message || 'Too many requests, please try again later.',
    statusCode: 429,
    keyGenerator: options.keyGenerator || ((req) => generateKey(req, options.prefix || 'redis')),
    standardHeaders: true,
    legacyHeaders: false,
    handler: options.handler || standardHandler
  });
};

// ============================================
// Per-Endpoint Rate Limiters
// ============================================

/**
 * Rate limiters for specific endpoints
 */
const endpointLimiters = {
  // Auth endpoints
  register: registrationLimiter,
  login: loginLimiter,
  forgotPassword: emailLimiter,
  resetPassword: authLimiter,
  verifyEmail: authLimiter,
  
  // User endpoints
  updateProfile: createAuthAwareLimiter(5, 20, 60000),
  changePassword: authLimiter,
  deleteAccount: authLimiter,
  
  // Session endpoints
  startSession: sessionLimiter,
  submitSession: sessionLimiter,
  
  // Payment endpoints
  createPayment: paymentLimiter,
  cancelSubscription: paymentLimiter,
  
  // Content endpoints
  createContent: adminLimiter,
  updateContent: adminLimiter,
  deleteContent: adminLimiter,
  
  // Search endpoints
  search: searchLimiter,
  
  // Upload endpoints
  upload: uploadLimiter,
  
  // API endpoints
  api: apiLimiter,
  
  // Webhook endpoints
  webhook: webhookLimiter
};

// ============================================
// Middleware Factory
// ============================================

/**
 * Create a rate limiter with custom configuration
 */
const createLimiter = (config) => {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.',
    keyGenerator = null,
    skip = null,
    handler = standardHandler,
    prefix = 'custom'
  } = config;
  
  return rateLimit({
    windowMs,
    max,
    message,
    statusCode: 429,
    keyGenerator: keyGenerator || ((req) => generateKey(req, prefix)),
    skip: skip || ((req) => isWhitelisted(req) || isDevelopment()),
    standardHeaders: true,
    legacyHeaders: false,
    handler
  });
};

// ============================================
// Export All Limiters
// ============================================

module.exports = {
  // Main limiters
  generalLimiter,
  authLimiter,
  loginLimiter,
  registrationLimiter,
  apiLimiter,
  sessionLimiter,
  paymentLimiter,
  emailLimiter,
  uploadLimiter,
  searchLimiter,
  webhookLimiter,
  adminLimiter,
  publicLimiter,
  
  // Dynamic limiters
  createDynamicLimiter,
  createAuthAwareLimiter,
  createRedisLimiter,
  createLimiter,
  
  // Per-endpoint limiters
  endpointLimiters,
  
  // Utilities
  getClientIp,
  generateKey,
  isWhitelisted,
  isDevelopment,
  
  // Handlers
  handlers: {
    standardHandler,
    loginHandler,
    registrationHandler,
    apiHandler
  }
};
