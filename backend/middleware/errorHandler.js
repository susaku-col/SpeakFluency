// ============================================
// Error Handler Middleware
// SpeakFlow - AI Language Learning Platform
// ============================================

const { logger } = require('./logging');

// ============================================
// Custom Error Classes
// ============================================

/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code || this.constructor.name;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error (400)
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication Error (401)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization Error (403)
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

/**
 * Rate Limit Error (429)
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }
}

/**
 * Database Error (500)
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

/**
 * Payment Error (402)
 */
class PaymentError extends AppError {
  constructor(message = 'Payment processing failed', code = 'PAYMENT_ERROR') {
    super(message, 402, code);
  }
}

/**
 * Subscription Error (402)
 */
class SubscriptionError extends AppError {
  constructor(message = 'Subscription required', code = 'SUBSCRIPTION_REQUIRED') {
    super(message, 402, code);
  }
}

/**
 * Business Logic Error (422)
 */
class BusinessError extends AppError {
  constructor(message, code = 'BUSINESS_ERROR', details = null) {
    super(message, 422, code, details);
  }
}

// ============================================
// Error Response Formatters
// ============================================

/**
 * Format error response for development
 */
const formatDevError = (err, req) => ({
  success: false,
  error: err.message,
  code: err.code || 'INTERNAL_SERVER_ERROR',
  statusCode: err.statusCode || 500,
  stack: err.stack,
  details: err.details,
  path: req.path,
  method: req.method,
  timestamp: new Date().toISOString()
});

/**
 * Format error response for production
 */
const formatProdError = (err) => ({
  success: false,
  error: err.isOperational ? err.message : 'Internal server error',
  code: err.code || 'INTERNAL_SERVER_ERROR',
  statusCode: err.statusCode || 500,
  ...(err.details && { details: err.details })
});

// ============================================
// Database Error Handlers
// ============================================

/**
 * Handle MongoDB duplicate key error
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyPattern)[0];
  const value = err.keyValue[field];
  return new ConflictError(`${field} '${value}' already exists`);
};

/**
 * Handle MongoDB validation error
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(e => ({
    field: e.path,
    message: e.message,
    value: e.value
  }));
  return new ValidationError('Validation failed', errors);
};

/**
 * Handle MongoDB cast error (invalid ID)
 */
const handleCastError = (err) => {
  return new ValidationError(`Invalid ${err.path}: ${err.value}`);
};

/**
 * Handle MongoDB duplicate key error (unique constraint)
 */
const handleMongoError = (err) => {
  switch (err.code) {
    case 11000:
      return handleDuplicateKeyError(err);
    case 121:
      return handleValidationError(err);
    default:
      return new DatabaseError(err.message, err);
  }
};

// ============================================
// JWT Error Handlers
// ============================================

/**
 * Handle JWT errors
 */
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return new AuthenticationError('Token has expired');
  }
  return new AuthenticationError('Authentication failed');
};

// ============================================
// Business Logic Error Handlers
// ============================================

/**
 * Handle payment provider errors
 */
const handlePaymentError = (err) => {
  // Stripe errors
  if (err.type === 'StripeCardError') {
    return new PaymentError(err.message, 'CARD_ERROR');
  }
  if (err.type === 'StripeRateLimitError') {
    return new RateLimitError('Too many payment attempts', 60);
  }
  if (err.type === 'StripeInvalidRequestError') {
    return new PaymentError('Invalid payment request', 'INVALID_PAYMENT_REQUEST');
  }
  return new PaymentError('Payment processing failed');
};

/**
 * Handle OpenAI API errors
 */
const handleOpenAIError = (err) => {
  if (err.status === 429) {
    return new RateLimitError('AI service rate limit exceeded', 30);
  }
  if (err.status === 401) {
    return new AuthenticationError('Invalid AI API key');
  }
  return new AppError('AI service unavailable', 503, 'AI_SERVICE_ERROR');
};

// ============================================
// Main Error Handler Middleware
// ============================================

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error(`${err.name}: ${err.message}`, {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode
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

  // Determine if in development mode
  const isDev = process.env.NODE_ENV === 'development';
  
  // Handle specific error types
  let error = err;
  
  // MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    error = handleMongoError(err);
  }
  
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }
  
  // Mongoose cast errors
  if (err.name === 'CastError') {
    error = handleCastError(err);
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err);
  }
  
  // Stripe errors
  if (err.type && err.type.startsWith('Stripe')) {
    error = handlePaymentError(err);
  }
  
  // OpenAI errors
  if (err.status && err.status === 429 && err.message.includes('openai')) {
    error = handleOpenAIError(err);
  }
  
  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = new ValidationError('File too large', { maxSize: '5MB' });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      error = new ValidationError('Too many files');
    } else {
      error = new ValidationError(err.message);
    }
  }
  
  // Rate limit errors
  if (err.name === 'RateLimitError') {
    error = new RateLimitError(err.message, err.retryAfter);
  }
  
  // Send response
  const response = isDev ? formatDevError(error, req) : formatProdError(error);
  
  // Add retry-after header for rate limit errors
  if (error instanceof RateLimitError && error.retryAfter) {
    res.setHeader('Retry-After', error.retryAfter);
  }
  
  res.status(error.statusCode || 500).json(response);
};

// ============================================
// 404 Handler Middleware
// ============================================

/**
 * Handle 404 - Route not found
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Cannot ${req.method} ${req.url}`);
  next(error);
};

// ============================================
// Async Handler Wrapper
// ============================================

/**
 * Wrapper for async route handlers to avoid try-catch
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wrapper for async middleware
 */
const asyncMiddleware = (fn) => {
  return asyncHandler(fn);
};

// ============================================
// Uncaught Exception & Rejection Handlers
// ============================================

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  });
  
  // Graceful shutdown
  process.exit(1);
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    }
  });
  
  // Graceful shutdown
  process.exit(1);
};

// ============================================
// Express Error Handlers for Specific Cases
// ============================================

/**
 * Handle body-parser errors
 */
const bodyParserErrorHandler = (err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large',
      code: 'PAYLOAD_TOO_LARGE',
      maxSize: '10mb'
    });
  }
  next(err);
};

/**
 * Handle CORS errors
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'Invalid CORS request') {
    return res.status(403).json({
      success: false,
      error: 'CORS request blocked',
      code: 'CORS_ERROR'
    });
  }
  next(err);
};

/**
 * Handle compression errors
 */
const compressionErrorHandler = (err, req, res, next) => {
  if (err.code === 'Z_BUF_ERROR') {
    return res.status(400).json({
      success: false,
      error: 'Invalid compressed data',
      code: 'COMPRESSION_ERROR'
    });
  }
  next(err);
};

// ============================================
// Health Check Error Handler
// ============================================

/**
 * Health check error handler (doesn't log errors)
 */
const healthCheckErrorHandler = (err, req, res, next) => {
  if (req.path === '/health' || req.path === '/ping') {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
  next(err);
};

// ============================================
// Export
// ============================================

module.exports = {
  // Main handlers
  errorHandler,
  notFoundHandler,
  
  // Async wrapper
  asyncHandler,
  asyncMiddleware,
  
  // Custom error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  PaymentError,
  SubscriptionError,
  BusinessError,
  
  // Specific error handlers
  handleDuplicateKeyError,
  handleValidationError,
  handleCastError,
  handleMongoError,
  handleJWTError,
  handlePaymentError,
  handleOpenAIError,
  
  // Express-specific handlers
  bodyParserErrorHandler,
  corsErrorHandler,
  compressionErrorHandler,
  healthCheckErrorHandler,
  
  // Global handlers
  handleUncaughtException,
  handleUnhandledRejection
};
