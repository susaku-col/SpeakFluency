// ============================================
// Validation Middleware
// SpeakFlow - AI Language Learning Platform
// ============================================

const { body, param, query, header, validationResult, oneOf } = require('express-validator');

// ============================================
// Custom Validation Helpers
// ============================================

/**
 * Check validation results middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Sanitize input (remove XSS, trim, etc.)
 */
const sanitizeInput = (value) => {
  if (typeof value === 'string') {
    // Trim whitespace
    value = value.trim();
    // Remove HTML tags (basic XSS protection)
    value = value.replace(/<[^>]*>/g, '');
    // Remove script tags
    value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  return value;
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
const isStrongPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Validate phone number
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate URL
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate date format (YYYY-MM-DD)
 */
const isValidDate = (date) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
};

/**
 * Validate UUID
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};

// ============================================
// Common Validation Rules
// ============================================

/**
 * Email validation rule
 */
const emailRule = () => 
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email cannot exceed 255 characters')
    .customSanitizer(value => value.toLowerCase());

/**
 * Password validation rule
 */
const passwordRule = (required = true) => {
  let rule = body('password');
  if (required) {
    rule = rule.notEmpty().withMessage('Password is required');
  }
  return rule
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .isLength({ max: 100 }).withMessage('Password cannot exceed 100 characters');
};

/**
 * Strong password validation rule
 */
const strongPasswordRule = (required = true) => {
  let rule = body('password');
  if (required) {
    rule = rule.notEmpty().withMessage('Password is required');
  }
  return rule
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .matches(/^(?=.*[!@#$%^&*(),.?":{}|<>])/).withMessage('Password must contain at least one special character');
};

/**
 * Name validation rule
 */
const nameRule = (field = 'name', required = true) => {
  let rule = body(field);
  if (required) {
    rule = rule.notEmpty().withMessage(`${field} is required`);
  }
  return rule
    .isLength({ min: 2, max: 50 }).withMessage(`${field} must be between 2 and 50 characters`)
    .matches(/^[a-zA-Z\s\-']+$/).withMessage(`${field} can only contain letters, spaces, hyphens, and apostrophes`);
};

/**
 * Phone validation rule
 */
const phoneRule = (required = false) => {
  let rule = body('phone');
  if (required) {
    rule = rule.notEmpty().withMessage('Phone number is required');
  }
  return rule
    .optional()
    .custom(isValidPhone).withMessage('Please provide a valid phone number');
};

/**
 * URL validation rule
 */
const urlRule = (field, required = false) => {
  let rule = body(field);
  if (required) {
    rule = rule.notEmpty().withMessage(`${field} is required`);
  }
  return rule
    .optional()
    .custom(isValidUrl).withMessage(`Please provide a valid URL for ${field}`);
};

/**
 * ID validation rule (UUID or ObjectId)
 */
const idRule = (paramName = 'id') => {
  return param(paramName)
    .notEmpty().withMessage(`${paramName} is required`)
    .custom(value => isValidUUID(value) || isValidObjectId(value)).withMessage(`Invalid ${paramName} format`);
};

/**
 * Pagination validation rules
 */
const paginationRules = () => [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('sortBy')
    .optional()
    .isString().withMessage('Sort by must be a string'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
];

/**
 * Date range validation rules
 */
const dateRangeRules = () => [
  query('startDate')
    .optional()
    .custom(isValidDate).withMessage('Start date must be in YYYY-MM-DD format'),
  query('endDate')
    .optional()
    .custom(isValidDate).withMessage('End date must be in YYYY-MM-DD format')
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate < req.query.startDate) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

// ============================================
// Auth Validation Rules
// ============================================

/**
 * Register validation
 */
const registerValidation = [
  emailRule(),
  strongPasswordRule(true),
  nameRule('name', true),
  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  body('termsAccepted')
    .notEmpty().withMessage('You must accept the terms and conditions')
    .isBoolean().withMessage('Invalid value')
    .custom(value => value === true).withMessage('You must accept the terms and conditions'),
  validate
];

/**
 * Login validation
 */
const loginValidation = [
  emailRule(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

/**
 * Forgot password validation
 */
const forgotPasswordValidation = [
  emailRule(),
  validate
];

/**
 * Reset password validation
 */
const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  strongPasswordRule(true),
  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  validate
];

/**
 * Change password validation
 */
const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  strongPasswordRule(true),
  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match'),
  validate
];

/**
 * Email verification validation
 */
const emailVerificationValidation = [
  query('token').notEmpty().withMessage('Verification token is required'),
  validate
];

// ============================================
// User Profile Validation Rules
// ============================================

/**
 * Update profile validation
 */
const updateProfileValidation = [
  nameRule('name', false),
  body('bio')
    .optional()
    .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  urlRule('avatar', false),
  body('country')
    .optional()
    .isString().withMessage('Country must be a string')
    .isLength({ min: 2, max: 2 }).withMessage('Country must be a 2-letter code'),
  body('timezone')
    .optional()
    .isString().withMessage('Timezone must be a string'),
  validate
];

/**
 * Update email validation
 */
const updateEmailValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required to update email'),
  validate
];

/**
 * User preferences validation
 */
const userPreferencesValidation = [
  body('preferences.language')
    .optional()
    .isIn(['en', 'es', 'fr', 'ja', 'ko', 'zh', 'de', 'it', 'pt', 'ru'])
    .withMessage('Invalid language selection'),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'system']).withMessage('Invalid theme selection'),
  body('preferences.fontSize')
    .optional()
    .isIn(['small', 'medium', 'large']).withMessage('Invalid font size'),
  body('preferences.reducedMotion')
    .optional()
    .isBoolean().withMessage('Reduced motion must be boolean'),
  body('preferences.highContrast')
    .optional()
    .isBoolean().withMessage('High contrast must be boolean'),
  body('preferences.notifications.email')
    .optional()
    .isBoolean().withMessage('Email notification setting must be boolean'),
  body('preferences.notifications.push')
    .optional()
    .isBoolean().withMessage('Push notification setting must be boolean'),
  body('preferences.learning.dailyGoal')
    .optional()
    .isInt({ min: 5, max: 120 }).withMessage('Daily goal must be between 5 and 120 minutes'),
  body('preferences.learning.reminderTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Reminder time must be in HH:MM format'),
  validate
];

// ============================================
// Session Validation Rules
// ============================================

/**
 * Start session validation
 */
const startSessionValidation = [
  body('lessonId')
    .optional()
    .isString().withMessage('Lesson ID must be a string'),
  body('type')
    .isIn(['pronunciation', 'vocabulary', 'grammar', 'speaking', 'listening', 'comprehensive'])
    .withMessage('Invalid session type'),
  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid difficulty level'),
  body('duration')
    .optional()
    .isInt({ min: 5, max: 120 }).withMessage('Duration must be between 5 and 120 minutes'),
  validate
];

/**
 * Submit session validation
 */
const submitSessionValidation = [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('answers')
    .optional()
    .isArray().withMessage('Answers must be an array'),
  body('duration')
    .isInt({ min: 1 }).withMessage('Valid duration is required'),
  validate
];

/**
 * Submit exercise validation
 */
const submitExerciseValidation = [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('exerciseId').notEmpty().withMessage('Exercise ID is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 }).withMessage('Time spent must be a positive integer'),
  validate
];

// ============================================
// Payment Validation Rules
// ============================================

/**
 * Create subscription validation
 */
const createSubscriptionValidation = [
  body('planId')
    .isIn(['free', 'pro_monthly', 'pro_yearly', 'family_monthly', 'family_yearly', 'enterprise'])
    .withMessage('Invalid plan ID'),
  body('paymentMethodId')
    .optional()
    .isString().withMessage('Invalid payment method'),
  body('couponCode')
    .optional()
    .isString().withMessage('Invalid coupon code'),
  validate
];

/**
 * Create payment intent validation
 */
const createPaymentIntentValidation = [
  body('amount')
    .isInt({ min: 100, max: 999999 }).withMessage('Amount must be between 100 and 999999'),
  body('currency')
    .optional()
    .isIn(['usd', 'eur', 'gbp', 'idr']).withMessage('Invalid currency'),
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object'),
  validate
];

/**
 * Coupon validation
 */
const couponValidation = [
  body('couponCode')
    .notEmpty().withMessage('Coupon code is required')
    .isString().withMessage('Coupon code must be a string'),
  body('planId')
    .optional()
    .isString().withMessage('Plan ID must be a string'),
  validate
];

// ============================================
// Admin Validation Rules
// ============================================

/**
 * Update user by admin validation
 */
const adminUpdateUserValidation = [
  nameRule('name', false),
  emailRule().optional(),
  body('role')
    .optional()
    .isIn(['user', 'premium', 'moderator', 'support', 'admin']).withMessage('Invalid role'),
  body('status')
    .optional()
    .isIn(['active', 'suspended', 'banned', 'inactive']).withMessage('Invalid status'),
  body('subscription.plan')
    .optional()
    .isIn(['free', 'pro', 'family', 'enterprise']).withMessage('Invalid subscription plan'),
  validate
];

/**
 * Create admin validation
 */
const createAdminValidation = [
  emailRule(),
  nameRule('name', true),
  body('role')
    .isIn(['admin', 'moderator', 'support']).withMessage('Invalid role for new admin'),
  validate
];

/**
 * System settings validation
 */
const systemSettingsValidation = [
  body('key')
    .notEmpty().withMessage('Setting key is required')
    .isString().withMessage('Setting key must be a string'),
  body('value')
    .notEmpty().withMessage('Setting value is required'),
  validate
];

// ============================================
// Content Validation Rules
// ============================================

/**
 * Create lesson validation
 */
const createLessonValidation = [
  body('title')
    .notEmpty().withMessage('Lesson title is required')
    .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('type')
    .isIn(['pronunciation', 'vocabulary', 'grammar', 'speaking', 'listening', 'comprehensive'])
    .withMessage('Invalid lesson type'),
  body('difficulty')
    .isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid difficulty'),
  body('duration')
    .isInt({ min: 5, max: 120 }).withMessage('Duration must be between 5 and 120 minutes'),
  body('content')
    .isObject().withMessage('Content must be an object'),
  validate
];

/**
 * Create vocabulary validation
 */
const createVocabularyValidation = [
  body('word')
    .notEmpty().withMessage('Word is required')
    .isLength({ min: 1, max: 50 }).withMessage('Word must be between 1 and 50 characters'),
  body('definitions')
    .isArray({ min: 1 }).withMessage('At least one definition is required'),
  body('definitions.*.meaning')
    .notEmpty().withMessage('Definition meaning is required'),
  body('wordType')
    .isIn(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'phrase', 'idiom'])
    .withMessage('Invalid word type'),
  body('difficulty')
    .isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid difficulty'),
  validate
];

// ============================================
// Support Ticket Validation Rules
// ============================================

/**
 * Create ticket validation
 */
const createTicketValidation = [
  body('subject')
    .notEmpty().withMessage('Subject is required')
    .isLength({ min: 5, max: 200 }).withMessage('Subject must be between 5 and 200 characters'),
  body('category')
    .isIn(['technical', 'billing', 'account', 'feature_request', 'bug_report', 'general', 'other'])
    .withMessage('Invalid category'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('message')
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10, max: 5000 }).withMessage('Message must be between 10 and 5000 characters'),
  body('attachments')
    .optional()
    .isArray().withMessage('Attachments must be an array'),
  validate
];

/**
 * Add message validation
 */
const addMessageValidation = [
  body('message')
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 5000 }).withMessage('Message must be between 1 and 5000 characters'),
  body('attachments')
    .optional()
    .isArray().withMessage('Attachments must be an array'),
  validate
];

/**
 * Update ticket status validation
 */
const updateTicketStatusValidation = [
  body('status')
    .isIn(['open', 'in_progress', 'waiting', 'resolved', 'closed']).withMessage('Invalid status'),
  body('note')
    .optional()
    .isString().withMessage('Note must be a string'),
  validate
];

// ============================================
// A/B Test Validation Rules
// ============================================

/**
 * Create A/B test validation
 */
const createAbTestValidation = [
  body('name')
    .notEmpty().withMessage('Test name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Test name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('variants')
    .isArray({ min: 2, max: 10 }).withMessage('Must have between 2 and 10 variants'),
  body('variants.*.name')
    .notEmpty().withMessage('Variant name is required'),
  body('variants.*.weight')
    .isInt({ min: 0, max: 100 }).withMessage('Variant weight must be between 0 and 100'),
  body('targeting')
    .optional()
    .isObject().withMessage('Targeting must be an object'),
  body('startDate')
    .optional()
    .custom(isValidDate).withMessage('Invalid start date format'),
  body('endDate')
    .optional()
    .custom(isValidDate).withMessage('Invalid end date format'),
  body('sampleSize')
    .optional()
    .isInt({ min: 100, max: 100000 }).withMessage('Sample size must be between 100 and 100,000'),
  validate
];

/**
 * Track A/B test event validation
 */
const trackAbTestEventValidation = [
  body('testId').notEmpty().withMessage('Test ID is required'),
  body('variantId').notEmpty().withMessage('Variant ID is required'),
  body('eventType')
    .isIn(['view', 'click', 'conversion', 'engagement', 'signup', 'purchase', 'completed'])
    .withMessage('Invalid event type'),
  body('metadata')
    .optional()
    .isObject().withMessage('Metadata must be an object'),
  validate
];

// ============================================
// Marketing Campaign Validation Rules
// ============================================

/**
 * Create campaign validation
 */
const createCampaignValidation = [
  body('name')
    .notEmpty().withMessage('Campaign name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Campaign name must be between 3 and 100 characters'),
  body('type')
    .isIn(['email', 'push', 'in_app', 'sms', 'social']).withMessage('Invalid campaign type'),
  body('audience')
    .isObject().withMessage('Audience configuration is required'),
  body('content')
    .isObject().withMessage('Content is required'),
  body('schedule')
    .optional()
    .isObject().withMessage('Schedule must be an object'),
  validate
];

/**
 * Create email template validation
 */
const createEmailTemplateValidation = [
  body('name')
    .notEmpty().withMessage('Template name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Template name must be between 3 and 100 characters'),
  body('subject')
    .notEmpty().withMessage('Email subject is required')
    .isLength({ max: 200 }).withMessage('Subject cannot exceed 200 characters'),
  body('htmlContent')
    .notEmpty().withMessage('HTML content is required'),
  body('textContent')
    .optional()
    .isString().withMessage('Text content must be a string'),
  body('category')
    .optional()
    .isIn(['onboarding', 'engagement', 'promotional', 'transactional', 'gamification', 'newsletter'])
    .withMessage('Invalid template category'),
  validate
];

// ============================================
// Export All Validation Rules
// ============================================

module.exports = {
  // Middleware
  validate,
  sanitizeInput,
  
  // Custom validators
  isValidEmail,
  isStrongPassword,
  isValidPhone,
  isValidUrl,
  isValidDate,
  isValidUUID,
  isValidObjectId,
  
  // Common rules
  emailRule,
  passwordRule,
  strongPasswordRule,
  nameRule,
  phoneRule,
  urlRule,
  idRule,
  paginationRules,
  dateRangeRules,
  
  // Auth validations
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  emailVerificationValidation,
  
  // User validations
  updateProfileValidation,
  updateEmailValidation,
  userPreferencesValidation,
  
  // Session validations
  startSessionValidation,
  submitSessionValidation,
  submitExerciseValidation,
  
  // Payment validations
  createSubscriptionValidation,
  createPaymentIntentValidation,
  couponValidation,
  
  // Admin validations
  adminUpdateUserValidation,
  createAdminValidation,
  systemSettingsValidation,
  
  // Content validations
  createLessonValidation,
  createVocabularyValidation,
  
  // Support validations
  createTicketValidation,
  addMessageValidation,
  updateTicketStatusValidation,
  
  // A/B Test validations
  createAbTestValidation,
  trackAbTestEventValidation,
  
  // Marketing validations
  createCampaignValidation,
  createEmailTemplateValidation
};
