// ============================================
// Logging Middleware
// SpeakFlow - AI Language Learning Platform
// ============================================

const winston = require('winston');
const morgan = require('morgan');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// ============================================
// Constants & Configuration
// ============================================

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5
};

const LOG_LEVEL_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  trace: 'gray'
};

// Log directory
const LOG_DIR = process.env.LOG_DIR || 'logs';
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// Custom Log Formats
// ============================================

/**
 * Custom log format for development
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

/**
 * Custom log format for production (JSON)
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Custom format for HTTP logging
 */
const httpFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  return `${timestamp} ${level}: ${message} ${JSON.stringify(meta)}`;
});

// ============================================
// Winston Transports
// ============================================

/**
 * Console transport (for development)
 */
const consoleTransport = new winston.transports.Console({
  level: LOG_LEVEL,
  format: devFormat,
  handleExceptions: true,
  handleRejections: true
});

/**
 * File transport for all logs
 */
const fileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: LOG_LEVEL,
  format: prodFormat,
  handleExceptions: true,
  handleRejections: true
});

/**
 * Error log transport (separate file)
 */
const errorFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: prodFormat,
  handleExceptions: true,
  handleRejections: true
});

/**
 * HTTP log transport
 */
const httpFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'http',
  format: prodFormat
});

/**
 * Audit log transport
 */
const auditFileTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d',
  level: 'info',
  format: prodFormat
});

// ============================================
// Winston Logger Configuration
// ============================================

const transports = [fileTransport, errorFileTransport, httpFileTransport];

// Add console transport in development
if (NODE_ENV === 'development') {
  transports.push(consoleTransport);
}

// Create the winston logger
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: LOG_LEVEL,
  format: prodFormat,
  transports,
  exitOnError: false
});

// Add audit logger
const auditLogger = winston.createLogger({
  levels: LOG_LEVELS,
  level: 'info',
  format: prodFormat,
  transports: [auditFileTransport, consoleTransport],
  exitOnError: false
});

// ============================================
// Morgan HTTP Logger Configuration
// ============================================

/**
 * Custom Morgan token for response time
 */
morgan.token('response-time-ms', (req, res) => {
  const responseTime = res.getHeader('X-Response-Time');
  return responseTime || '-';
});

/**
 * Custom Morgan token for user ID
 */
morgan.token('user-id', (req) => {
  return req.user?.id || 'anonymous';
});

/**
 * Custom Morgan token for request ID
 */
morgan.token('request-id', (req) => {
  return req.id || '-';
});

/**
 * Custom Morgan token for IP address
 */
morgan.token('real-ip', (req) => {
  return req.ip || req.connection.remoteAddress || '-';
});

/**
 * Custom Morgan token for user agent
 */
morgan.token('user-agent', (req) => {
  return req.headers['user-agent'] || '-';
});

/**
 * Custom Morgan token for referrer
 */
morgan.token('referrer', (req) => {
  return req.headers['referer'] || req.headers['referrer'] || '-';
});

/**
 * Development format
 */
const devMorganFormat = 'dev';

/**
 * Production format (combined + custom fields)
 */
const prodMorganFormat = ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms ms';

/**
 * Detailed format for API logging
 */
const detailedMorganFormat = ':real-ip - :user-id [:date[iso]] ":method :url" :status :response-time-ms ms - :res[content-length] bytes - ":user-agent" - "request-id: :request-id"';

/**
 * Morgan stream for Winston
 */
const morganStream = {
  write: (message) => {
    // Remove newline and log at http level
    logger.http(message.trim());
  }
};

/**
 * Create Morgan middleware based on environment
 */
const morganMiddleware = morgan(
  NODE_ENV === 'development' ? devMorganFormat : prodMorganFormat,
  { stream: morganStream, skip: (req) => req.url === '/health' || req.url === '/ping' }
);

/**
 * Detailed Morgan middleware for API routes
 */
const detailedMorganMiddleware = morgan(detailedMorganFormat, {
  stream: morganStream,
  skip: (req) => req.url === '/health'
});

// ============================================
// Custom Logging Middleware
// ============================================

/**
 * Request logging middleware
 * Logs incoming requests with details
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Generate request ID if not present
  if (!req.id) {
    req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Log request start
  logger.debug(`Request started: ${req.method} ${req.url}`, {
    requestId: req.id,
    method: req.method,
    url: req.url,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id
  });
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to log response
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Set response time header
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Request-ID', req.id);
    
    // Log response
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel](`Request completed: ${req.method} ${req.url} - ${statusCode} (${duration}ms)`, {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode,
      duration,
      contentLength: res.getHeader('content-length'),
      userId: req.user?.id
    });
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Response time middleware
 */
const responseTimeMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const responseTime = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(3);
    res.setHeader('X-Response-Time', `${responseTime}ms`);
  });
  
  next();
};

/**
 * Audit logging middleware for sensitive operations
 */
const auditMiddleware = (action, getDetails = null) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Store original json function
    const originalJson = res.json;
    
    res.json = function(data) {
      const duration = Date.now() - startTime;
      
      // Log audit entry
      const auditEntry = {
        action,
        userId: req.user?.id,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString(),
        details: getDetails ? getDetails(req, data) : {
          body: req.body,
          query: req.query,
          params: req.params,
          response: data
        }
      };
      
      auditLogger.info('Audit', auditEntry);
      
      // Call original json
      originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Error logging middleware
 */
const errorLogger = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code
    },
    request: {
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.body,
      params: req.params,
      ip: req.ip,
      userId: req.user?.id,
      requestId: req.id
    }
  });
  
  next(err);
};

/**
 * Performance logging middleware
 */
const performanceLogger = (thresholdMs = 1000) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > thresholdMs) {
        logger.warn(`Slow request detected: ${req.method} ${req.url} took ${duration}ms`, {
          method: req.method,
          url: req.url,
          duration,
          threshold: thresholdMs,
          userId: req.user?.id,
          query: req.query
        });
      }
    });
    
    next();
  };
};

/**
 * Database query logging middleware
 */
const dbQueryLogger = (query, duration, metadata = {}) => {
  if (duration > 100) {
    logger.warn(`Slow database query: ${duration}ms`, {
      query,
      duration,
      ...metadata
    });
  } else {
    logger.debug(`Database query: ${duration}ms`, {
      query,
      duration,
      ...metadata
    });
  }
};

/**
 * External API call logging
 */
const externalApiLogger = (service, url, method, duration, status, error = null) => {
  const logLevel = error ? 'error' : status >= 400 ? 'warn' : 'info';
  
  logger[logLevel](`External API call to ${service}: ${method} ${url} - ${status} (${duration}ms)`, {
    service,
    url,
    method,
    duration,
    status,
    error: error?.message
  });
};

// ============================================
// Helper Functions
// ============================================

/**
 * Log user action
 */
const logUserAction = (userId, action, details = {}) => {
  logger.info(`User action: ${action}`, {
    userId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log system event
 */
const logSystemEvent = (event, details = {}) => {
  logger.info(`System event: ${event}`, {
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log security event
 */
const logSecurityEvent = (event, userId = null, details = {}) => {
  logger.warn(`Security event: ${event}`, {
    event,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log business event (purchase, subscription, etc.)
 */
const logBusinessEvent = (event, userId, details = {}) => {
  logger.info(`Business event: ${event}`, {
    event,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Get request summary for logging
 */
const getRequestSummary = (req) => {
  return {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    requestId: req.id
  };
};

/**
 * Get error summary for logging
 */
const getErrorSummary = (err) => {
  return {
    message: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack
  };
};

// ============================================
// Export
// ============================================

module.exports = {
  // Main logger
  logger,
  auditLogger,
  
  // Middleware
  morganMiddleware,
  detailedMorganMiddleware,
  requestLogger,
  responseTimeMiddleware,
  auditMiddleware,
  errorLogger,
  performanceLogger,
  
  // Helper functions
  dbQueryLogger,
  externalApiLogger,
  logUserAction,
  logSystemEvent,
  logSecurityEvent,
  logBusinessEvent,
  getRequestSummary,
  getErrorSummary,
  
  // Winston transports (for advanced configuration)
  transports: {
    consoleTransport,
    fileTransport,
    errorFileTransport,
    httpFileTransport,
    auditFileTransport
  }
};
