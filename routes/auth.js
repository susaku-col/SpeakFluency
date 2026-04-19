/* ============================================
   SPEAKFLOW - AUTHENTICATION MODULE
   Version: 1.0.0
   Handles user authentication, registration, and session management
   ============================================ */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { body } = require('express-validator');

// ============================================
// CONFIGURATION
// ============================================

const AuthConfig = {
    jwt: {
        secret: process.env.JWT_SECRET || 'speakflow_jwt_secret_key',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'speakflow_refresh_secret_key',
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256',
        issuer: 'speakflow',
        audience: 'speakflow-api'
    },
    bcrypt: {
        saltRounds: 10
    },
    rateLimit: {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000, // 15 minutes
        blockDuration: 30 * 60 * 1000 // 30 minutes
    },
    tokens: {
        passwordResetExpiry: 3600000, // 1 hour
        emailVerificationExpiry: 86400000, // 24 hours
        refreshTokenExpiry: 604800000 // 7 days
    }
};

// ============================================
// DATABASE MODELS (Simulated)
// ============================================

// In production, replace with actual database models
const UserModel = {
    users: [],
    
    async create(userData) {
        const user = {
            id: this.users.length + 1,
            ...userData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isVerified: false,
            isActive: true,
            loginAttempts: 0,
            lastLoginAt: null,
            lastLoginIP: null
        };
        this.users.push(user);
        return user;
    },
    
    async findByEmail(email) {
        return this.users.find(u => u.email === email);
    },
    
    async findById(id) {
        return this.users.find(u => u.id === id);
    },
    
    async update(id, updates) {
        const index = this.users.findIndex(u => u.id === id);
        if (index === -1) return null;
        
        this.users[index] = {
            ...this.users[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        return this.users[index];
    },
    
    async updateLoginAttempts(email, increment = true) {
        const user = await this.findByEmail(email);
        if (!user) return null;
        
        if (increment) {
            user.loginAttempts++;
        } else {
            user.loginAttempts = 0;
        }
        return user;
    },
    
    async isLocked(email) {
        const user = await this.findByEmail(email);
        if (!user) return false;
        
        if (user.loginAttempts >= AuthConfig.rateLimit.maxAttempts) {
            const lastAttempt = new Date(user.lastLoginAttempt || 0);
            const lockUntil = new Date(lastAttempt.getTime() + AuthConfig.rateLimit.blockDuration);
            return new Date() < lockUntil;
        }
        return false;
    }
};

// ============================================
// TOKEN MANAGER
// ============================================

class TokenManager {
    constructor() {
        this.blacklistedTokens = new Set();
        this.refreshTokens = new Map();
    }
    
    generateAccessToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role || 'user',
            isPremium: user.isPremium || false
        };
        
        return jwt.sign(payload, AuthConfig.jwt.secret, {
            expiresIn: AuthConfig.jwt.expiresIn,
            algorithm: AuthConfig.jwt.algorithm,
            issuer: AuthConfig.jwt.issuer,
            audience: AuthConfig.jwt.audience
        });
    }
    
    generateRefreshToken(user) {
        const token = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date(Date.now() + AuthConfig.tokens.refreshTokenExpiry);
        
        this.refreshTokens.set(token, {
            userId: user.id,
            expiresAt,
            createdAt: new Date()
        });
        
        return token;
    }
    
    generateEmailVerificationToken(user) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + AuthConfig.tokens.emailVerificationExpiry);
        
        return { token, expiresAt };
    }
    
    generatePasswordResetToken(user) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + AuthConfig.tokens.passwordResetExpiry);
        
        return { token, expiresAt };
    }
    
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, AuthConfig.jwt.secret, {
                algorithms: [AuthConfig.jwt.algorithm],
                issuer: AuthConfig.jwt.issuer,
                audience: AuthConfig.jwt.audience
            });
            return { valid: true, decoded };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
    
    verifyRefreshToken(token) {
        const storedToken = this.refreshTokens.get(token);
        if (!storedToken) {
            return { valid: false, error: 'Invalid refresh token' };
        }
        
        if (new Date() > storedToken.expiresAt) {
            this.refreshTokens.delete(token);
            return { valid: false, error: 'Refresh token expired' };
        }
        
        return { valid: true, data: storedToken };
    }
    
    revokeRefreshToken(token) {
        return this.refreshTokens.delete(token);
    }
    
    revokeAllUserRefreshTokens(userId) {
        let count = 0;
        for (const [token, data] of this.refreshTokens.entries()) {
            if (data.userId === userId) {
                this.refreshTokens.delete(token);
                count++;
            }
        }
        return count;
    }
    
    blacklistToken(token) {
        this.blacklistedTokens.add(token);
        // Clean up old tokens periodically
        setTimeout(() => {
            this.blacklistedTokens.delete(token);
        }, 3600000); // 1 hour
    }
    
    isTokenBlacklisted(token) {
        return this.blacklistedTokens.has(token);
    }
}

// ============================================
// AUTH SERVICE
// ============================================

class AuthService {
    constructor() {
        this.tokenManager = new TokenManager();
        this.loginAttempts = new Map();
    }
    
    async register(userData) {
        // Validate email uniqueness
        const existingUser = await UserModel.findByEmail(userData.email);
        if (existingUser) {
            throw new Error('User already exists with this email');
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, AuthConfig.bcrypt.saltRounds);
        
        // Generate email verification token
        const { token: emailVerificationToken, expiresAt: emailVerificationExpires } = 
            this.tokenManager.generateEmailVerificationToken({ email: userData.email });
        
        // Create user
        const user = await UserModel.create({
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            emailVerificationToken,
            emailVerificationExpires,
            role: 'user',
            isPremium: false,
            preferences: {
                goal: null,
                level: null,
                persona: null,
                interests: [],
                schedule: 15
            }
        });
        
        // Generate tokens
        const accessToken = this.tokenManager.generateAccessToken(user);
        const refreshToken = this.tokenManager.generateRefreshToken(user);
        
        // Send verification email (in production)
        await this.sendVerificationEmail(user.email, emailVerificationToken);
        
        return {
            user: this.sanitizeUser(user),
            accessToken,
            refreshToken
        };
    }
    
    async login(email, password, ipAddress = null) {
        // Check if account is locked
        const isLocked = await UserModel.isLocked(email);
        if (isLocked) {
            throw new Error('Account is temporarily locked due to too many failed attempts');
        }
        
        // Find user
        const user = await UserModel.findByEmail(email);
        if (!user) {
            await UserModel.updateLoginAttempts(email, true);
            throw new Error('Invalid credentials');
        }
        
        // Check if account is active
        if (!user.isActive) {
            throw new Error('Account is deactivated. Please contact support.');
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            await UserModel.updateLoginAttempts(email, true);
            throw new Error('Invalid credentials');
        }
        
        // Reset login attempts on successful login
        await UserModel.updateLoginAttempts(email, false);
        
        // Update last login info
        await UserModel.update(user.id, {
            lastLoginAt: new Date().toISOString(),
            lastLoginIP: ipAddress
        });
        
        // Generate tokens
        const accessToken = this.tokenManager.generateAccessToken(user);
        const refreshToken = this.tokenManager.generateRefreshToken(user);
        
        return {
            user: this.sanitizeUser(user),
            accessToken,
            refreshToken
        };
    }
    
    async refreshAccessToken(refreshToken) {
        const verification = this.tokenManager.verifyRefreshToken(refreshToken);
        if (!verification.valid) {
            throw new Error(verification.error);
        }
        
        const user = await UserModel.findById(verification.data.userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const newAccessToken = this.tokenManager.generateAccessToken(user);
        
        return { accessToken: newAccessToken };
    }
    
    async logout(accessToken, refreshToken) {
        // Blacklist access token
        this.tokenManager.blacklistToken(accessToken);
        
        // Revoke refresh token
        if (refreshToken) {
            this.tokenManager.revokeRefreshToken(refreshToken);
        }
        
        return { success: true };
    }
    
    async logoutAllDevices(userId, currentRefreshToken = null) {
        const count = this.tokenManager.revokeAllUserRefreshTokens(userId);
        
        // Optionally blacklist current token as well
        if (currentRefreshToken) {
            this.tokenManager.revokeRefreshToken(currentRefreshToken);
        }
        
        return { revokedCount: count };
    }
    
    async verifyEmail(token) {
        const user = await UserModel.findByEmailVerificationToken(token);
        if (!user) {
            throw new Error('Invalid verification token');
        }
        
        if (new Date() > new Date(user.emailVerificationExpires)) {
            throw new Error('Verification token has expired');
        }
        
        await UserModel.update(user.id, {
            isVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null
        });
        
        return { success: true };
    }
    
    async resendVerificationEmail(email) {
        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw new Error('User not found');
        }
        
        if (user.isVerified) {
            throw new Error('Email already verified');
        }
        
        const { token: emailVerificationToken, expiresAt: emailVerificationExpires } = 
            this.tokenManager.generateEmailVerificationToken(user);
        
        await UserModel.update(user.id, {
            emailVerificationToken,
            emailVerificationExpires
        });
        
        await this.sendVerificationEmail(user.email, emailVerificationToken);
        
        return { success: true };
    }
    
    async forgotPassword(email) {
        const user = await UserModel.findByEmail(email);
        if (!user) {
            // Don't reveal that user doesn't exist for security
            return { success: true };
        }
        
        const { token: resetToken, expiresAt: resetExpires } = 
            this.tokenManager.generatePasswordResetToken(user);
        
        await UserModel.update(user.id, {
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires
        });
        
        await this.sendPasswordResetEmail(user.email, resetToken);
        
        return { success: true };
    }
    
    async resetPassword(token, newPassword) {
        const user = await UserModel.findByPasswordResetToken(token);
        if (!user) {
            throw new Error('Invalid reset token');
        }
        
        if (new Date() > new Date(user.passwordResetExpires)) {
            throw new Error('Reset token has expired');
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, AuthConfig.bcrypt.saltRounds);
        
        await UserModel.update(user.id, {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null
        });
        
        // Revoke all sessions after password change
        this.tokenManager.revokeAllUserRefreshTokens(user.id);
        
        return { success: true };
    }
    
    async changePassword(userId, currentPassword, newPassword) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            throw new Error('Current password is incorrect');
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, AuthConfig.bcrypt.saltRounds);
        
        await UserModel.update(userId, {
            password: hashedPassword
        });
        
        // Revoke all sessions except current
        // this.tokenManager.revokeAllUserRefreshTokens(userId);
        
        return { success: true };
    }
    
    async updateProfile(userId, updates) {
        const allowedUpdates = ['name', 'preferences', 'goal', 'level', 'persona', 'interests'];
        const filteredUpdates = {};
        
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        const updatedUser = await UserModel.update(userId, filteredUpdates);
        
        return this.sanitizeUser(updatedUser);
    }
    
    async deleteAccount(userId, password) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw new Error('Invalid password');
        }
        
        // Soft delete
        await UserModel.update(userId, {
            isActive: false,
            deletedAt: new Date().toISOString()
        });
        
        // Revoke all sessions
        this.tokenManager.revokeAllUserRefreshTokens(userId);
        
        return { success: true };
    }
    
    sanitizeUser(user) {
        const { password, emailVerificationToken, emailVerificationExpires, passwordResetToken, passwordResetExpires, ...sanitized } = user;
        return sanitized;
    }
    
    async sendVerificationEmail(email, token) {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
        
        // In production, use email service (SendGrid, AWS SES, etc.)
        console.log(`[Email] Verification link: ${verificationUrl}`);
        
        // Example with SendGrid:
        /*
        const msg = {
            to: email,
            from: process.env.EMAIL_FROM,
            subject: 'Verify Your SpeakFlow Email',
            html: `
                <h1>Welcome to SpeakFlow!</h1>
                <p>Please verify your email by clicking the link below:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>This link expires in 24 hours.</p>
            `
        };
        await sgMail.send(msg);
        */
        
        return true;
    }
    
    async sendPasswordResetEmail(email, token) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        
        console.log(`[Email] Password reset link: ${resetUrl}`);
        
        // In production, use email service
        return true;
    }
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

class AuthMiddleware {
    constructor(authService) {
        this.authService = authService;
    }
    
    authenticate = async (req, res, next) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Check if token is blacklisted
        if (this.authService.tokenManager.isTokenBlacklisted(token)) {
            return res.status(401).json({ error: 'Token has been revoked' });
        }
        
        const verification = this.authService.tokenManager.verifyAccessToken(token);
        
        if (!verification.valid) {
            return res.status(401).json({ error: verification.error });
        }
        
        req.user = verification.decoded;
        next();
    };
    
    optionalAuthenticate = async (req, res, next) => {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const verification = this.authService.tokenManager.verifyAccessToken(token);
            
            if (verification.valid && !this.authService.tokenManager.isTokenBlacklisted(token)) {
                req.user = verification.decoded;
            }
        }
        
        next();
    };
    
    requireRole = (...roles) => {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            
            next();
        };
    };
    
    requirePremium = async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (!req.user.isPremium) {
            return res.status(403).json({ error: 'Premium subscription required' });
        }
        
        next();
    };
    
    rateLimit = (maxAttempts = AuthConfig.rateLimit.maxAttempts, windowMs = AuthConfig.rateLimit.windowMs) => {
        const attempts = new Map();
        
        return (req, res, next) => {
            const key = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const now = Date.now();
            
            if (!attempts.has(key)) {
                attempts.set(key, { count: 0, resetTime: now + windowMs });
            }
            
            const record = attempts.get(key);
            
            if (now > record.resetTime) {
                record.count = 0;
                record.resetTime = now + windowMs;
            }
            
            record.count++;
            
            if (record.count > maxAttempts) {
                return res.status(429).json({
                    error: 'Too many attempts',
                    retryAfter: Math.ceil((record.resetTime - now) / 1000)
                });
            }
            
            next();
        };
    };
}

// ============================================
// VALIDATION RULES
// ============================================

const AuthValidation = {
    register: [
        body('name')
            .trim()
            .notEmpty().withMessage('Name is required')
            .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
            .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),
        
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Please provide a valid email')
            .normalizeEmail(),
        
        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
            .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
            .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
            .matches(/[0-9]/).withMessage('Password must contain at least one number')
            .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),
        
        body('confirmPassword')
            .notEmpty().withMessage('Please confirm your password')
            .custom((value, { req }) => value === req.body.password)
            .withMessage('Passwords do not match')
    ],
    
    login: [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Please provide a valid email')
            .normalizeEmail(),
        
        body('password')
            .notEmpty().withMessage('Password is required')
    ],
    
    changePassword: [
        body('currentPassword')
            .notEmpty().withMessage('Current password is required'),
        
        body('newPassword')
            .notEmpty().withMessage('New password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
            .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
            .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
            .matches(/[0-9]/).withMessage('Password must contain at least one number'),
        
        body('confirmNewPassword')
            .notEmpty().withMessage('Please confirm your new password')
            .custom((value, { req }) => value === req.body.newPassword)
            .withMessage('Passwords do not match')
    ],
    
    resetPassword: [
        body('token')
            .notEmpty().withMessage('Reset token is required'),
        
        body('newPassword')
            .notEmpty().withMessage('New password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    
    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
            .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),
        
        body('goal')
            .optional()
            .isIn(['ielts', 'business', 'daily', 'travel', 'academic', 'interview'])
            .withMessage('Invalid goal selected'),
        
        body('level')
            .optional()
            .isIn(['beginner', 'elementary', 'intermediate', 'upper', 'advanced'])
            .withMessage('Invalid level selected'),
        
        body('persona')
            .optional()
            .isIn(['friendly', 'strict', 'fun', 'professional'])
            .withMessage('Invalid persona selected')
    ]
};

// ============================================
// AUTH ROUTES
// ============================================

function createAuthRoutes(authService, authMiddleware) {
    const router = require('express').Router();
    
    // Register
    router.post('/register', AuthValidation.register, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const result = await authService.register(req.body);
            res.status(201).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Login
    router.post('/login', AuthValidation.login, authMiddleware.rateLimit(), async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const result = await authService.login(req.body.email, req.body.password, ipAddress);
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });
    
    // Refresh token
    router.post('/refresh', async (req, res) => {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }
        
        try {
            const result = await authService.refreshAccessToken(refreshToken);
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });
    
    // Logout
    router.post('/logout', authMiddleware.authenticate, async (req, res) => {
        const refreshToken = req.body.refreshToken;
        const accessToken = req.headers.authorization?.split(' ')[1];
        
        await authService.logout(accessToken, refreshToken);
        res.json({ success: true });
    });
    
    // Logout all devices
    router.post('/logout-all', authMiddleware.authenticate, async (req, res) => {
        const refreshToken = req.body.refreshToken;
        const result = await authService.logoutAllDevices(req.user.id, refreshToken);
        res.json(result);
    });
    
    // Verify email
    router.post('/verify-email', async (req, res) => {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Verification token required' });
        }
        
        try {
            await authService.verifyEmail(token);
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Resend verification email
    router.post('/resend-verification', async (req, res) => {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }
        
        try {
            await authService.resendVerificationEmail(email);
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Forgot password
    router.post('/forgot-password', async (req, res) => {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }
        
        await authService.forgotPassword(email);
        res.json({ success: true });
    });
    
    // Reset password
    router.post('/reset-password', AuthValidation.resetPassword, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            await authService.resetPassword(req.body.token, req.body.newPassword);
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Get current user
    router.get('/me', authMiddleware.authenticate, async (req, res) => {
        // User info is already in req.user from token
        // In production, fetch fresh from database
        res.json(req.user);
    });
    
    // Change password
    router.post('/change-password', authMiddleware.authenticate, AuthValidation.changePassword, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Update profile
    router.put('/profile', authMiddleware.authenticate, AuthValidation.updateProfile, async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const updatedUser = await authService.updateProfile(req.user.id, req.body);
            res.json(updatedUser);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    // Delete account
    router.delete('/account', authMiddleware.authenticate, async (req, res) => {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }
        
        try {
            await authService.deleteAccount(req.user.id, password);
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
    
    return router;
}

// ============================================
// SOCIAL AUTH HANDLERS
// ============================================

class SocialAuthHandler {
    constructor(authService) {
        this.authService = authService;
    }
    
    async handleGoogleCallback(profile) {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        
        let user = await UserModel.findByEmail(email);
        
        if (!user) {
            // Create new user
            user = await UserModel.create({
                name,
                email,
                password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
                isVerified: true,
                authProvider: 'google',
                authProviderId: profile.id
            });
        }
        
        const accessToken = this.authService.tokenManager.generateAccessToken(user);
        const refreshToken = this.authService.tokenManager.generateRefreshToken(user);
        
        return { user: this.authService.sanitizeUser(user), accessToken, refreshToken };
    }
    
    async handleGitHubCallback(profile) {
        const email = profile.emails[0].value;
        const name = profile.displayName || profile.username;
        
        let user = await UserModel.findByEmail(email);
        
        if (!user) {
            user = await UserModel.create({
                name,
                email,
                password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
                isVerified: true,
                authProvider: 'github',
                authProviderId: profile.id
            });
        }
        
        const accessToken = this.authService.tokenManager.generateAccessToken(user);
        const refreshToken = this.authService.tokenManager.generateRefreshToken(user);
        
        return { user: this.authService.sanitizeUser(user), accessToken, refreshToken };
    }
}

// ============================================
// EXPORTS
// ============================================

const authService = new AuthService();
const authMiddleware = new AuthMiddleware(authService);
const authRoutes = createAuthRoutes(authService, authMiddleware);
const socialAuthHandler = new SocialAuthHandler(authService);

module.exports = {
    authService,
    authMiddleware,
    authRoutes,
    socialAuthHandler,
    AuthConfig,
    AuthValidation,
    TokenManager,
    UserModel
};
