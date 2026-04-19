/* ============================================
   SPEAKFLOW - AUTH CONTROLLER
   Version: 1.0.0
   Handles authentication HTTP requests and responses
   ============================================ */

const { validationResult } = require('express-validator');
const crypto = require('crypto');

// ============================================
// AUTH CONTROLLER
// ============================================

class AuthController {
    constructor(authService) {
        this.authService = authService;
    }

    /**
     * Register a new user
     * POST /api/auth/register
     */
    register = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        try {
            const { email, password, name } = req.body;
            
            const result = await this.authService.register({
                email,
                password,
                name
            });

            // Set refresh token as HTTP-only cookie
            this.setRefreshTokenCookie(res, result.refreshToken);

            return res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: result.user,
                    accessToken: result.accessToken
                }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Login user
     * POST /api/auth/login
     */
    login = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        try {
            const { email, password } = req.body;
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            
            const result = await this.authService.login(email, password, ipAddress);

            // Set refresh token as HTTP-only cookie
            this.setRefreshTokenCookie(res, result.refreshToken);

            return res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: result.user,
                    accessToken: result.accessToken
                }
            });
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Refresh access token
     * POST /api/auth/refresh
     */
    refreshToken = async (req, res) => {
        try {
            // Get refresh token from cookie or body
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
            
            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    error: 'Refresh token required'
                });
            }

            const result = await this.authService.refreshAccessToken(refreshToken);

            // Set new refresh token cookie
            this.setRefreshTokenCookie(res, result.refreshToken);

            return res.json({
                success: true,
                data: {
                    accessToken: result.accessToken
                }
            });
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Logout user
     * POST /api/auth/logout
     */
    logout = async (req, res) => {
        try {
            const accessToken = req.headers.authorization?.split(' ')[1];
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
            
            await this.authService.logout(accessToken, refreshToken);

            // Clear refresh token cookie
            this.clearRefreshTokenCookie(res);

            return res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Logout from all devices
     * POST /api/auth/logout-all
     */
    logoutAllDevices = async (req, res) => {
        try {
            const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
            
            await this.authService.logoutAllDevices(req.user.id, refreshToken);

            // Clear refresh token cookie
            this.clearRefreshTokenCookie(res);

            return res.json({
                success: true,
                message: 'Logged out from all devices'
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Get current user profile
     * GET /api/auth/me
     */
    getCurrentUser = async (req, res) => {
        try {
            // User info is attached by auth middleware
            // Optionally fetch fresh data from database
            const user = await this.authService.getUserById(req.user.id);
            
            return res.json({
                success: true,
                data: { user }
            });
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Verify email
     * POST /api/auth/verify-email
     */
    verifyEmail = async (req, res) => {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Verification token required'
            });
        }

        try {
            await this.authService.verifyEmail(token);

            return res.json({
                success: true,
                message: 'Email verified successfully'
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Resend verification email
     * POST /api/auth/resend-verification
     */
    resendVerification = async (req, res) => {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email required'
            });
        }

        try {
            await this.authService.resendVerificationEmail(email);

            return res.json({
                success: true,
                message: 'Verification email sent'
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Forgot password - send reset link
     * POST /api/auth/forgot-password
     */
    forgotPassword = async (req, res) => {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email required'
            });
        }

        try {
            await this.authService.forgotPassword(email);

            // Always return success even if email not found (security)
            return res.json({
                success: true,
                message: 'If an account exists with that email, a password reset link has been sent'
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Reset password
     * POST /api/auth/reset-password
     */
    resetPassword = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { token, newPassword } = req.body;

        try {
            await this.authService.resetPassword(token, newPassword);

            return res.json({
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Change password (authenticated)
     * POST /api/auth/change-password
     */
    changePassword = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        try {
            await this.authService.changePassword(req.user.id, currentPassword, newPassword);

            return res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Update profile
     * PUT /api/auth/profile
     */
    updateProfile = async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        try {
            const updatedUser = await this.authService.updateProfile(req.user.id, req.body);

            return res.json({
                success: true,
                message: 'Profile updated successfully',
                data: { user: updatedUser }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Delete account
     * DELETE /api/auth/account
     */
    deleteAccount = async (req, res) => {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                error: 'Password required'
            });
        }

        try {
            await this.authService.deleteAccount(req.user.id, password);

            // Clear refresh token cookie
            this.clearRefreshTokenCookie(res);

            return res.json({
                success: true,
                message: 'Account deleted successfully'
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Social login - Google
     * GET /api/auth/google
     */
    googleAuth = (req, res) => {
        // Redirect to Google OAuth
        const redirectUri = process.env.GOOGLE_REDIRECT_URI;
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const scope = 'email profile';
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${redirectUri}&` +
            `response_type=code&` +
            `scope=${scope}&` +
            `access_type=offline`;
        
        res.redirect(authUrl);
    };

    /**
     * Social login - Google callback
     * GET /api/auth/google/callback
     */
    googleCallback = async (req, res) => {
        const { code } = req.query;
        
        if (!code) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
        }

        try {
            // Exchange code for tokens and get user info
            // This would typically call Google API
            const result = await this.authService.handleGoogleCallback(code);
            
            // Set refresh token cookie
            this.setRefreshTokenCookie(res, result.refreshToken);
            
            // Redirect to frontend with access token
            const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${result.accessToken}`;
            res.redirect(redirectUrl);
        } catch (error) {
            res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
        }
    };

    /**
     * Social login - GitHub
     * GET /api/auth/github
     */
    githubAuth = (req, res) => {
        const redirectUri = process.env.GITHUB_REDIRECT_URI;
        const clientId = process.env.GITHUB_CLIENT_ID;
        const scope = 'user:email';
        
        const authUrl = `https://github.com/login/oauth/authorize?` +
            `client_id=${clientId}&` +
            `redirect_uri=${redirectUri}&` +
            `scope=${scope}`;
        
        res.redirect(authUrl);
    };

    /**
     * Social login - GitHub callback
     * GET /api/auth/github/callback
     */
    githubCallback = async (req, res) => {
        const { code } = req.query;
        
        if (!code) {
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=github_auth_failed`);
        }

        try {
            const result = await this.authService.handleGitHubCallback(code);
            
            this.setRefreshTokenCookie(res, result.refreshToken);
            
            const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?accessToken=${result.accessToken}`;
            res.redirect(redirectUrl);
        } catch (error) {
            res.redirect(`${process.env.FRONTEND_URL}/login?error=github_auth_failed`);
        }
    };

    /**
     * Set refresh token as HTTP-only cookie
     */
    setRefreshTokenCookie(res, refreshToken) {
        const isProduction = process.env.NODE_ENV === 'production';
        
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
    }

    /**
     * Clear refresh token cookie
     */
    clearRefreshTokenCookie(res) {
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });
    }

    /**
     * CSRF Token generation
     * GET /api/auth/csrf-token
     */
    getCSRFToken = (req, res) => {
        const token = crypto.randomBytes(32).toString('hex');
        
        // Store token in session or cache
        req.session.csrfToken = token;
        
        return res.json({
            success: true,
            data: { csrfToken: token }
        });
    };

    /**
     * Verify CSRF token middleware
     */
    verifyCSRFToken = (req, res, next) => {
        const token = req.headers['x-csrf-token'] || req.body._csrf;
        
        if (!token || token !== req.session.csrfToken) {
            return res.status(403).json({
                success: false,
                error: 'Invalid CSRF token'
            });
        }
        
        next();
    };

    /**
     * Check if email exists
     * POST /api/auth/check-email
     */
    checkEmail = async (req, res) => {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email required'
            });
        }

        try {
            const exists = await this.authService.emailExists(email);
            
            return res.json({
                success: true,
                data: { exists }
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * Validate reset token
     * POST /api/auth/validate-reset-token
     */
    validateResetToken = async (req, res) => {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token required'
            });
        }

        try {
            const isValid = await this.authService.validateResetToken(token);
            
            return res.json({
                success: true,
                data: { isValid }
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };
}

module.exports = AuthController;
