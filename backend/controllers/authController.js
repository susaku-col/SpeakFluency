// ============================================
// Auth Controller
// SpeakFlow - AI Language Learning Platform
// ============================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

// ============================================
// Constants & Configuration
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'speakflow-super-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'speakflow-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;

// ============================================
// Mock Database (In production, use real database)
// ============================================

// User storage
const users = new Map();

// Refresh token storage
const refreshTokens = new Map();

// Password reset tokens
const passwordResetTokens = new Map();

// Email verification tokens
const emailVerificationTokens = new Map();

// Login attempts tracking
const loginAttempts = new Map();

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
 * Hash password
 */
const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

/**
 * Compare password with hash
 */
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate JWT access token
 */
const generateAccessToken = (userId, email, role = 'user') => {
  return jwt.sign(
    { 
      id: userId, 
      email: email,
      role: role,
      type: 'access'
    },
    JWT_SECRET,
    { 
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'speakflow',
      audience: 'speakflow-api'
    }
  );
};

/**
 * Generate JWT refresh token
 */
const generateRefreshToken = (userId) => {
  const refreshToken = jwt.sign(
    { 
      id: userId, 
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    { 
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'speakflow',
      audience: 'speakflow-api'
    }
  );
  
  // Store refresh token
  refreshTokens.set(refreshToken, {
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  });
  
  return refreshToken;
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const storedToken = refreshTokens.get(token);
    
    if (!storedToken || storedToken.userId !== decoded.id) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Revoke refresh token
 */
const revokeRefreshToken = (token) => {
  refreshTokens.delete(token);
};

/**
 * Generate random token for password reset / email verification
 */
const generateRandomToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Track login attempts
 */
const trackLoginAttempt = (email, success = false) => {
  const key = email.toLowerCase();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, { attempts: [], lockedUntil: null });
  }
  
  const record = loginAttempts.get(key);
  
  // Clean old attempts
  record.attempts = record.attempts.filter(timestamp => now - timestamp < windowMs);
  
  if (!success) {
    record.attempts.push(now);
    
    // Lock after 5 failed attempts
    if (record.attempts.length >= 5 && !record.lockedUntil) {
      record.lockedUntil = now + (15 * 60 * 1000); // Lock for 15 minutes
    }
  } else {
    // Reset on successful login
    record.attempts = [];
    record.lockedUntil = null;
  }
  
  loginAttempts.set(key, record);
  return record;
};

/**
 * Check if account is locked
 */
const isAccountLocked = (email) => {
  const record = loginAttempts.get(email.toLowerCase());
  if (!record || !record.lockedUntil) return false;
  
  if (Date.now() > record.lockedUntil) {
    record.lockedUntil = null;
    loginAttempts.set(email.toLowerCase(), record);
    return false;
  }
  
  return true;
};

/**
 * Get remaining lock time
 */
const getLockTimeRemaining = (email) => {
  const record = loginAttempts.get(email.toLowerCase());
  if (!record || !record.lockedUntil) return 0;
  
  const remaining = Math.max(0, record.lockedUntil - Date.now());
  return Math.ceil(remaining / 1000 / 60); // minutes
};

/**
 * Send email (mock - integrate with actual email service)
 */
const sendEmail = async (to, subject, html, text) => {
  console.log(`[EMAIL] To: ${to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  console.log(`[EMAIL] Body: ${text || html}`);
  
  // In production, integrate with SendGrid, AWS SES, etc.
  return { success: true, messageId: generateId('email') };
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (email, name) => {
  const subject = 'Welcome to SpeakFlow! 🎉';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to SpeakFlow! 🎯</h1>
        </div>
        <h2>Hi ${name},</h2>
        <p>We're excited to have you on board! You've taken the first step towards mastering English speaking.</p>
        <p>Here's what you can do next:</p>
        <ul>
          <li>🎤 Take your first pronunciation assessment</li>
          <li>📚 Explore our library of lessons</li>
          <li>🎮 Start earning XP and achievements</li>
        </ul>
        <div style="text-align: center;">
          <a href="https://speakflow.com/dashboard" class="button">Start Your First Lesson →</a>
        </div>
        <p>Happy learning!<br>The SpeakFlow Team</p>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(email, subject, html, `Welcome to SpeakFlow! Start your first lesson today.`);
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetUrl = `https://speakflow.com/reset-password?token=${resetToken}`;
  const subject = 'Reset Your SpeakFlow Password';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Password Reset Request</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password →</a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="font-size: 12px; color: #666;">SpeakFlow - AI Language Learning Platform</p>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(email, subject, html, `Reset your password: ${resetUrl}`);
};

/**
 * Send email verification email
 */
const sendVerificationEmail = async (email, name, verificationToken) => {
  const verifyUrl = `https://speakflow.com/verify-email?token=${verificationToken}`;
  const subject = 'Verify Your Email Address';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Verify Your Email Address</h2>
        <p>Hi ${name},</p>
        <p>Please verify your email address to complete your registration:</p>
        <div style="text-align: center;">
          <a href="${verifyUrl}" class="button">Verify Email →</a>
        </div>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail(email, subject, html, `Verify your email: ${verifyUrl}`);
};

// ============================================
// Initialize Demo User
// ============================================

const initDemoUser = async () => {
  const demoEmail = 'demo@speakflow.com';
  
  if (!users.has(demoEmail)) {
    const hashedPassword = await hashPassword('demo123');
    users.set(demoEmail, {
      id: generateId('user'),
      email: demoEmail,
      password: hashedPassword,
      name: 'Demo User',
      role: 'user',
      status: 'active',
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      preferences: {
        language: 'en',
        theme: 'light',
        notifications: true
      },
      stats: {
        totalSessions: 0,
        totalMinutes: 0,
        averageScore: 0,
        streak: 0,
        level: 1,
        xp: 0
      }
    });
    console.log('[INIT] Demo user created: demo@speakflow.com / demo123');
  }
};

// Initialize demo user
initDemoUser();

// ============================================
// Controller Methods
// ============================================

/**
 * Register new user
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    if (users.has(email.toLowerCase())) {
      return res.status(409).json({
        success: false,
        error: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create verification token
    const verificationToken = generateRandomToken();

    // Create new user
    const userId = generateId('user');
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      role: 'user',
      status: 'active',
      isEmailVerified: false,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      preferences: {
        language: 'en',
        theme: 'light',
        notifications: true,
        emailNotifications: true
      },
      stats: {
        totalSessions: 0,
        totalMinutes: 0,
        averageScore: 0,
        streak: 0,
        level: 1,
        xp: 0,
        pronunciationScore: 0,
        vocabularyScore: 0,
        grammarScore: 0,
        fluencyScore: 0
      }
    };

    // Store verification token
    emailVerificationTokens.set(verificationToken, {
      userId,
      email: email.toLowerCase(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    // Save user
    users.set(email.toLowerCase(), newUser);

    // Send verification email (async, don't wait)
    sendVerificationEmail(email, name, verificationToken).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    // Generate tokens
    const accessToken = generateAccessToken(userId, email, 'user');
    const refreshToken = generateRefreshToken(userId);

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      data: {
        user: userWithoutPassword,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: JWT_EXPIRES_IN
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during registration',
      code: 'REGISTRATION_FAILED'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    // Check if account is locked
    if (isAccountLocked(normalizedEmail)) {
      const minutesRemaining = getLockTimeRemaining(normalizedEmail);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Account locked for ${minutesRemaining} minutes.`,
        code: 'ACCOUNT_LOCKED',
        lockTimeRemaining: minutesRemaining
      });
    }

    // Find user
    const user = users.get(normalizedEmail);
    if (!user) {
      trackLoginAttempt(normalizedEmail, false);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      trackLoginAttempt(normalizedEmail, false);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if email is verified (optional - can be commented out for testing)
    // if (!user.isEmailVerified) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Please verify your email before logging in',
    //     code: 'EMAIL_NOT_VERIFIED'
    //   });
    // }

    // Check if account is suspended/banned
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: 'Your account has been banned.',
        code: 'ACCOUNT_BANNED'
      });
    }

    // Track successful login
    trackLoginAttempt(normalizedEmail, true);

    // Update last login
    user.lastLogin = new Date().toISOString();
    users.set(normalizedEmail, user);

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: JWT_EXPIRES_IN
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during login',
      code: 'LOGIN_FAILED'
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    
    if (refreshToken) {
      revokeRefreshToken(refreshToken);
    }
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during logout'
    });
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
        code: 'NO_REFRESH_TOKEN'
      });
    }
    
    // Verify refresh token
    const decoded = await verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    // Find user
    let user = null;
    for (const [_, u] of users.entries()) {
      if (u.id === decoded.id) {
        user = u;
        break;
      }
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken(user.id, user.email, user.role);
    const newRefreshToken = generateRefreshToken(user.id);
    
    // Revoke old refresh token
    revokeRefreshToken(refreshToken);
    
    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: JWT_EXPIRES_IN
      }
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during token refresh'
    });
  }
};

/**
 * Verify email
 * GET /api/auth/verify-email
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token required',
        code: 'NO_TOKEN'
      });
    }
    
    const verificationData = emailVerificationTokens.get(token);
    
    if (!verificationData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (new Date() > verificationData.expiresAt) {
      emailVerificationTokens.delete(token);
      return res.status(400).json({
        success: false,
        error: 'Verification token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    const user = users.get(verificationData.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date().toISOString();
    users.set(verificationData.email, user);
    
    emailVerificationTokens.delete(token);
    
    // Send welcome email
    sendWelcomeEmail(user.email, user.name).catch(err => {
      console.error('Failed to send welcome email:', err);
    });
    
    res.json({
      success: true,
      message: 'Email verified successfully. You can now login.'
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during email verification'
    });
  }
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 */
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        code: 'EMAIL_REQUIRED'
      });
    }
    
    const user = users.get(email.toLowerCase());
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email already verified',
        code: 'ALREADY_VERIFIED'
      });
    }
    
    // Create new verification token
    const verificationToken = generateRandomToken();
    emailVerificationTokens.set(verificationToken, {
      userId: user.id,
      email: user.email,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
    
    // Send verification email
    await sendVerificationEmail(user.email, user.name, verificationToken);
    
    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Forgot password - send reset email
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { email } = req.body;
    const user = users.get(email.toLowerCase());
    
    // Always return success for security (don't reveal if email exists)
    if (user) {
      // Generate reset token
      const resetToken = generateRandomToken();
      passwordResetTokens.set(resetToken, {
        userId: user.id,
        email: user.email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      });
      
      // Send reset email
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    }
    
    res.json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Reset password
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    
    const { token, password } = req.body;
    
    const resetData = passwordResetTokens.get(token);
    
    if (!resetData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (new Date() > resetData.expiresAt) {
      passwordResetTokens.delete(token);
      return res.status(400).json({
        success: false,
        error: 'Reset token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    const user = users.get(resetData.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(password);
    user.password = hashedPassword;
    user.passwordUpdatedAt = new Date().toISOString();
    users.set(resetData.email, user);
    
    // Delete used token
    passwordResetTokens.delete(token);
    
    // Revoke all refresh tokens for this user (optional)
    for (const [rt, data] of refreshTokens.entries()) {
      if (data.userId === user.id) {
        refreshTokens.delete(rt);
      }
    }
    
    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Change password (authenticated)
 * POST /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
        code: 'MISSING_FIELDS'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    // Find user
    let user = null;
    for (const [_, u] of users.entries()) {
      if (u.id === userId) {
        user = u;
        break;
      }
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Verify current password
    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    user.passwordUpdatedAt = new Date().toISOString();
    users.set(user.email, user);
    
    // Revoke all refresh tokens for this user (force re-login)
    for (const [rt, data] of refreshTokens.entries()) {
      if (data.userId === user.id) {
        refreshTokens.delete(rt);
      }
    }
    
    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get current user profile (authenticated)
 * GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find user
    let user = null;
    for (const [_, u] of users.entries()) {
      if (u.id === userId) {
        user = u;
        break;
      }
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      data: userWithoutPassword
    });
    
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Verify JWT token
 * GET /api/auth/verify
 */
exports.verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user
    let user = null;
    for (const [_, u] of users.entries()) {
      if (u.id === decoded.id) {
        user = u;
        break;
      }
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * Social login with Google
 * POST /api/auth/social/google
 */
exports.googleLogin = async (req, res) => {
  try {
    const { googleToken, email, name, picture } = req.body;
    
    if (!googleToken || !email) {
      return res.status(400).json({
        success: false,
        error: 'Google token and email required',
        code: 'MISSING_FIELDS'
      });
    }
    
    // In production: verify Google token with Google API
    // const payload = await verifyGoogleToken(googleToken);
    
    let user = users.get(email.toLowerCase());
    
    if (!user) {
      // Create new user with Google data
      const userId = generateId('user');
      user = {
        id: userId,
        email: email.toLowerCase(),
        password: null, // No password for social login
        name: name || email.split('@')[0],
        avatar: picture || null,
        role: 'user',
        status: 'active',
        isEmailVerified: true, // Google accounts are verified
        provider: 'google',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        preferences: {
          language: 'en',
          theme: 'light',
          notifications: true
        },
        stats: {
          totalSessions: 0,
          totalMinutes: 0,
          averageScore: 0,
          streak: 0,
          level: 1,
          xp: 0
        }
      };
      users.set(email.toLowerCase(), user);
      
      // Send welcome email
      sendWelcomeEmail(user.email, user.name).catch(err => {
        console.error('Failed to send welcome email:', err);
      });
    } else {
      user.lastLogin = new Date().toISOString();
      users.set(email.toLowerCase(), user);
    }
    
    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);
    
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: userWithoutPassword,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: JWT_EXPIRES_IN
        }
      }
    });
    
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      error: 'Google authentication failed',
      code: 'SOCIAL_AUTH_FAILED'
    });
  }
};

/**
 * Get login attempts info (for debugging)
 * GET /api/auth/login-attempts
 */
exports.getLoginAttempts = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    const record = loginAttempts.get(email.toLowerCase());
    
    res.json({
      success: true,
      data: {
        email,
        attempts: record?.attempts.length || 0,
        isLocked: isAccountLocked(email),
        lockTimeRemaining: getLockTimeRemaining(email)
      }
    });
    
  } catch (error) {
    console.error('Get login attempts error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ============================================
// Export all methods
// ============================================

module.exports = exports;
