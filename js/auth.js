// ============================================
// SpeakFlow Authentication Module
// User Authentication & Authorization
// ============================================

// ============================================
// Auth State Management
// ============================================

const AuthState = {
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    tokenExpiry: null,
    refreshTokenTimeout: null
};

// ============================================
// Token Management
// ============================================

/**
 * Save tokens to localStorage
 */
const saveTokens = (accessToken, refreshToken, expiresIn) => {
    if (accessToken) {
        localStorage.setItem('access_token', accessToken);
        AuthState.token = accessToken;
    }
    
    if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
        AuthState.refreshToken = refreshToken;
    }
    
    if (expiresIn) {
        const expiryTime = Date.now() + (expiresIn * 1000);
        localStorage.setItem('token_expiry', expiryTime.toString());
        AuthState.tokenExpiry = expiryTime;
        
        // Schedule token refresh
        scheduleTokenRefresh(expiresIn);
    }
};

/**
 * Load tokens from localStorage
 */
const loadTokens = () => {
    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const tokenExpiry = localStorage.getItem('token_expiry');
    
    if (accessToken && refreshToken && tokenExpiry) {
        AuthState.token = accessToken;
        AuthState.refreshToken = refreshToken;
        AuthState.tokenExpiry = parseInt(tokenExpiry);
        
        // Check if token is still valid
        if (Date.now() < AuthState.tokenExpiry) {
            AuthState.isAuthenticated = true;
            const expiresIn = Math.floor((AuthState.tokenExpiry - Date.now()) / 1000);
            scheduleTokenRefresh(expiresIn);
            return true;
        } else {
            // Token expired, try to refresh
            refreshAccessToken();
        }
    }
    
    return false;
};

/**
 * Schedule token refresh before expiry
 */
const scheduleTokenRefresh = (expiresIn) => {
    if (AuthState.refreshTokenTimeout) {
        clearTimeout(AuthState.refreshTokenTimeout);
    }
    
    // Refresh 5 minutes before expiry
    const refreshTime = Math.max(0, (expiresIn - 300) * 1000);
    
    AuthState.refreshTokenTimeout = setTimeout(() => {
        refreshAccessToken();
    }, refreshTime);
};

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = async () => {
    if (!AuthState.refreshToken) {
        logout();
        return false;
    }
    
    try {
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refreshToken: AuthState.refreshToken
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            saveTokens(
                data.data.token,
                data.data.refreshToken,
                parseExpiresIn(data.data.expiresIn)
            );
            return true;
        } else {
            logout();
            return false;
        }
    } catch (error) {
        console.error('Token refresh failed:', error);
        logout();
        return false;
    }
};

/**
 * Parse expiresIn string to seconds
 */
const parseExpiresIn = (expiresIn) => {
    if (typeof expiresIn === 'number') return expiresIn;
    if (typeof expiresIn === 'string') {
        const match = expiresIn.match(/(\d+)([dhms])/);
        if (match) {
            const value = parseInt(match[1]);
            const unit = match[2];
            switch (unit) {
                case 'd': return value * 86400;
                case 'h': return value * 3600;
                case 'm': return value * 60;
                default: return value;
            }
        }
    }
    return 3600; // Default 1 hour
};

/**
 * Clear tokens from storage
 */
const clearTokens = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expiry');
    localStorage.removeItem('user');
    
    if (AuthState.refreshTokenTimeout) {
        clearTimeout(AuthState.refreshTokenTimeout);
    }
    
    AuthState.token = null;
    AuthState.refreshToken = null;
    AuthState.tokenExpiry = null;
    AuthState.isAuthenticated = false;
    AuthState.user = null;
};

// ============================================
// Authentication API Calls
// ============================================

/**
 * Register new user
 */
const register = async (userData) => {
    AuthState.isLoading = true;
    showLoadingOverlay();
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store user data temporarily for verification
            sessionStorage.setItem('pending_verification_email', userData.email);
            
            showToast(
                'Account created successfully! Please check your email to verify your account.',
                'success',
                'Registration Successful'
            );
            
            // Redirect to verification page or show verification message
            setTimeout(() => {
                showVerificationModal(userData.email);
            }, 2000);
            
            return { success: true, data: data.data };
        } else {
            showToast(data.error || 'Registration failed', 'error', 'Registration Error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Failed to create account. Please try again.', 'error', 'Network Error');
        return { success: false, error: error.message };
    } finally {
        AuthState.isLoading = false;
        hideLoadingOverlay();
    }
};

/**
 * Login user
 */
const login = async (email, password, rememberMe = false) => {
    AuthState.isLoading = true;
    showLoadingOverlay();
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const { user, tokens } = data.data;
            
            // Save user data
            AuthState.user = user;
            AuthState.isAuthenticated = true;
            localStorage.setItem('user', JSON.stringify(user));
            
            // Save tokens
            const expiresIn = parseExpiresIn(tokens.expiresIn);
            saveTokens(tokens.accessToken, tokens.refreshToken, expiresIn);
            
            // Update UI
            updateAuthUI();
            
            showToast(`Welcome back, ${user.name}!`, 'success', 'Login Successful');
            
            // Trigger auth change event
            window.dispatchEvent(new CustomEvent('auth:login', { detail: { user } }));
            
            return { success: true, user };
        } else {
            // Handle account lock
            if (data.code === 'ACCOUNT_LOCKED') {
                showToast(
                    `Too many failed attempts. Account locked for ${data.lockTimeRemaining} minutes.`,
                    'warning',
                    'Account Locked'
                );
            } else {
                showToast(data.error || 'Login failed', 'error', 'Login Failed');
            }
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Failed to login. Please check your connection.', 'error', 'Network Error');
        return { success: false, error: error.message };
    } finally {
        AuthState.isLoading = false;
        hideLoadingOverlay();
    }
};

/**
 * Logout user
 */
const logout = async () => {
    AuthState.isLoading = true;
    
    try {
        if (AuthState.token) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AuthState.token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.error('Logout API error:', error);
    } finally {
        clearTokens();
        updateAuthUI();
        
        showToast('You have been logged out successfully.', 'info', 'Logged Out');
        
        window.dispatchEvent(new CustomEvent('auth:logout'));
        
        // Redirect to home page
        if (window.navigateTo) {
            window.navigateTo('home');
        } else {
            window.location.href = '/';
        }
        
        AuthState.isLoading = false;
    }
};

/**
 * Verify email with token
 */
const verifyEmail = async (token) => {
    AuthState.isLoading = true;
    showLoadingOverlay();
    
    try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(
                'Email verified successfully! You can now login.',
                'success',
                'Email Verified'
            );
            
            // Clear pending verification
            sessionStorage.removeItem('pending_verification_email');
            
            // Show login modal
            setTimeout(() => {
                if (window.showLoginModal) {
                    window.showLoginModal();
                }
            }, 2000);
            
            return { success: true };
        } else {
            showToast(data.error || 'Email verification failed', 'error', 'Verification Failed');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Email verification error:', error);
        showToast('Failed to verify email. Please try again.', 'error', 'Network Error');
        return { success: false, error: error.message };
    } finally {
        AuthState.isLoading = false;
        hideLoadingOverlay();
    }
};

/**
 * Resend verification email
 */
const resendVerificationEmail = async (email) => {
    AuthState.isLoading = true;
    
    try {
        const response = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(
                'Verification email sent! Please check your inbox.',
                'success',
                'Email Sent'
            );
            return { success: true };
        } else {
            showToast(data.error || 'Failed to send verification email', 'error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        showToast('Failed to send verification email', 'error');
        return { success: false, error: error.message };
    } finally {
        AuthState.isLoading = false;
    }
};

/**
 * Request password reset
 */
const forgotPassword = async (email) => {
    AuthState.isLoading = true;
    
    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(
                'If an account exists with that email, you will receive a password reset link.',
                'success',
                'Reset Email Sent'
            );
            return { success: true };
        } else {
            showToast(data.error || 'Failed to send reset email', 'error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showToast('Failed to send reset email. Please try again.', 'error');
        return { success: false, error: error.message };
    } finally {
        AuthState.isLoading = false;
    }
};

/**
 * Reset password with token
 */
const resetPassword = async (token, password, confirmPassword) => {
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error', 'Validation Error');
        return { success: false, error: 'Passwords do not match' };
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error', 'Validation Error');
        return { success: false, error: 'Password too short' };
    }
    
    AuthState.isLoading = true;
    showLoadingOverlay();
    
    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, password, confirmPassword })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(
                'Password reset successfully! You can now login with your new password.',
                'success',
                'Password Reset'
            );
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                if (window.showLoginModal) {
                    window.showLoginModal();
                }
            }, 2000);
            
            return { success: true };
        } else {
            showToast(data.error || 'Password reset failed', 'error', 'Reset Failed');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showToast('Failed to reset password. Please try again.', 'error');
        return { success: false, error: error.message };
    } finally {
        AuthState.isLoading = false;
        hideLoadingOverlay();
    }
};

/**
 * Change password (authenticated user)
 */
const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error', 'Validation Error');
        return { success: false, error: 'Passwords do not match' };
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters', 'error', 'Validation Error');
        return { success: false, error: 'Password too short' };
    }
    
    AuthState.isLoading = true;
    
    try {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthState.token}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword,
                confirmPassword
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(
                'Password changed successfully! Please login again.',
                'success',
                'Password Changed'
            );
            
            // Logout after password change
            setTimeout(() => {
                logout();
            }, 2000);
            
            return { success: true };
        } else {
            showToast(data.error || 'Failed to change password', 'error');
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error('Change password error:', error);
        showToast('Failed to change password. Please try again.', 'error');
        return { success: false, error: error.message };
    } finally {
        AuthState.isLoading = false;
    }
};

// ============================================
// Social Authentication
// ============================================

/**
 * Social login handlers
 */
const socialLogin = {
    google: () => {
        window.location.href = '/api/auth/google';
    },
    
    facebook: () => {
        window.location.href = '/api/auth/facebook';
    },
    
    apple: () => {
        window.location.href = '/api/auth/apple';
    },
    
    github: () => {
        window.location.href = '/api/auth/github';
    }
};

/**
 * Handle social login callback
 */
const handleSocialCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const refreshToken = urlParams.get('refreshToken');
    
    if (token && refreshToken) {
        // Get user info from API
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                AuthState.user = data.data;
                AuthState.isAuthenticated = true;
                localStorage.setItem('user', JSON.stringify(data.data));
                
                const expiresIn = parseExpiresIn('7d');
                saveTokens(token, refreshToken, expiresIn);
                
                updateAuthUI();
                showToast(`Welcome, ${data.data.name}!`, 'success', 'Login Successful');
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                return true;
            }
        } catch (error) {
            console.error('Social login callback error:', error);
        }
    }
    
    return false;
};

// ============================================
// Two-Factor Authentication (2FA)
// ============================================

/**
 * Setup 2FA
 */
const setup2FA = async () => {
    try {
        const response = await fetch('/api/auth/2fa/setup', {
            headers: {
                'Authorization': `Bearer ${AuthState.token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                qrCode: data.data.qrCode,
                secret: data.data.secret,
                backupCodes: data.data.backupCodes
            };
        }
        return { success: false, error: data.error };
    } catch (error) {
        console.error('2FA setup error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Verify 2FA code
 */
const verify2FA = async (code) => {
    try {
        const response = await fetch('/api/auth/2fa/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthState.token}`
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Two-factor authentication enabled successfully!', 'success');
            return { success: true };
        }
        return { success: false, error: data.error };
    } catch (error) {
        console.error('2FA verification error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Disable 2FA
 */
const disable2FA = async (code) => {
    try {
        const response = await fetch('/api/auth/2fa/disable', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthState.token}`
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Two-factor authentication disabled.', 'info');
            return { success: true };
        }
        return { success: false, error: data.error };
    } catch (error) {
        console.error('2FA disable error:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// Session Management
// ============================================

/**
 * Get current session info
 */
const getSessionInfo = async () => {
    try {
        const response = await fetch('/api/auth/session', {
            headers: {
                'Authorization': `Bearer ${AuthState.token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        }
        return null;
    } catch (error) {
        console.error('Get session error:', error);
        return null;
    }
};

/**
 * Terminate other sessions
 */
const terminateOtherSessions = async () => {
    try {
        const response = await fetch('/api/auth/sessions/terminate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AuthState.token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Other sessions terminated successfully.', 'success');
            return { success: true };
        }
        return { success: false, error: data.error };
    } catch (error) {
        console.error('Terminate sessions error:', error);
        return { success: false, error: error.message };
    }
};

// ============================================
// UI Helpers
// ============================================

/**
 * Show loading overlay
 */
const showLoadingOverlay = () => {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Loading...</p>
        `;
        document.body.appendChild(overlay);
    }
    overlay.classList.add('active');
};

/**
 * Hide loading overlay
 */
const hideLoadingOverlay = () => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
};

/**
 * Show verification modal
 */
const showVerificationModal = (email) => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Verify Your Email</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>We've sent a verification email to <strong>${email}</strong>.</p>
                <p>Please check your inbox and click the verification link to activate your account.</p>
                <div class="alert alert-info" style="margin-top: 16px;">
                    <span class="alert-icon">📧</span>
                    <span>Didn't receive the email? Check your spam folder or click below to resend.</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="resend-verification">Resend Email</button>
                <button class="btn btn-primary" id="close-verification">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#close-verification').addEventListener('click', closeModal);
    
    modal.querySelector('#resend-verification').addEventListener('click', async () => {
        await resendVerificationEmail(email);
        closeModal();
    });
};

/**
 * Show password reset modal
 */
const showPasswordResetModal = () => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Reset Password</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="forgot-password-form">
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <input type="email" name="email" class="form-input" required placeholder="Enter your email">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="cancel-reset">Cancel</button>
                <button class="btn btn-primary" id="submit-reset">Send Reset Link</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-reset').addEventListener('click', closeModal);
    
    modal.querySelector('#submit-reset').addEventListener('click', async () => {
        const email = modal.querySelector('input[name="email"]').value;
        if (email) {
            await forgotPassword(email);
            closeModal();
        } else {
            showToast('Please enter your email address', 'warning');
        }
    });
};

/**
 * Update UI based on auth state
 */
const updateAuthUI = () => {
    const authButtons = document.querySelectorAll('.auth-required');
    const guestButtons = document.querySelectorAll('.guest-only');
    const userMenuContainer = document.getElementById('user-menu-container');
    
    if (AuthState.isAuthenticated && AuthState.user) {
        // Show authenticated UI
        authButtons.forEach(el => el.style.display = 'block');
        guestButtons.forEach(el => el.style.display = 'none');
        
        // Update user menu
        if (userMenuContainer) {
            userMenuContainer.innerHTML = `
                <div class="dropdown">
                    <button class="dropdown-toggle btn-ghost" id="user-menu-btn">
                        <span class="avatar-sm">${AuthState.user.name?.charAt(0) || 'U'}</span>
                        <span>${AuthState.user.name?.split(' ')[0] || 'User'}</span>
                        <span class="dropdown-arrow">▼</span>
                    </button>
                    <div class="dropdown-menu" id="user-dropdown">
                        <a href="#" onclick="navigateTo('profile')" class="dropdown-item">
                            <span class="dropdown-icon">👤</span> Profile
                        </a>
                        <a href="#" onclick="navigateTo('dashboard')" class="dropdown-item">
                            <span class="dropdown-icon">📊</span> Dashboard
                        </a>
                        <a href="#" onclick="navigateTo('settings')" class="dropdown-item">
                            <span class="dropdown-icon">⚙️</span> Settings
                        </a>
                        <div class="dropdown-divider"></div>
                        <a href="#" onclick="auth.logout()" class="dropdown-item">
                            <span class="dropdown-icon">🚪</span> Logout
                        </a>
                    </div>
                </div>
            `;
            
            // Setup dropdown toggle
            const userMenuBtn = document.getElementById('user-menu-btn');
            const userDropdown = document.getElementById('user-dropdown');
            
            if (userMenuBtn && userDropdown) {
                userMenuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    userDropdown.classList.toggle('show');
                });
                
                document.addEventListener('click', () => {
                    userDropdown.classList.remove('show');
                });
            }
        }
    } else {
        // Show guest UI
        authButtons.forEach(el => el.style.display = 'none');
        guestButtons.forEach(el => el.style.display = 'block');
        
        if (userMenuContainer) {
            userMenuContainer.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="window.showLoginModal?.()">Login</button>
                <button class="btn btn-primary btn-sm" onclick="window.showSignupModal?.()">Sign Up</button>
            `;
        }
    }
};

// ============================================
// Auth Middleware for Routes
// ============================================

/**
 * Require authentication for route
 */
const requireAuth = (callback) => {
    if (AuthState.isAuthenticated) {
        callback();
    } else {
        showToast('Please login to access this page', 'warning', 'Authentication Required');
        if (window.showLoginModal) {
            window.showLoginModal();
        }
    }
};

/**
 * Require guest (non-authenticated) for route
 */
const requireGuest = (callback) => {
    if (!AuthState.isAuthenticated) {
        callback();
    } else {
        window.navigateTo('dashboard');
    }
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize auth module
 */
const initAuth = () => {
    // Load tokens from storage
    const hasValidToken = loadTokens();
    
    if (hasValidToken) {
        // Load user data
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            AuthState.user = JSON.parse(savedUser);
            AuthState.isAuthenticated = true;
        } else {
            // Fetch user data
            fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${AuthState.token}`
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    AuthState.user = data.data;
                    localStorage.setItem('user', JSON.stringify(data.data));
                    updateAuthUI();
                }
            })
            .catch(error => console.error('Failed to fetch user:', error));
        }
        
        updateAuthUI();
    }
    
    // Handle social login callback
    handleSocialCallback();
    
    // Setup auth event listeners
    window.addEventListener('auth:login', (e) => {
        updateAuthUI();
    });
    
    window.addEventListener('auth:logout', () => {
        updateAuthUI();
    });
};

// ============================================
// Export Auth Module
// ============================================

const auth = {
    // State
    get user() { return AuthState.user; },
    get isAuthenticated() { return AuthState.isAuthenticated; },
    get token() { return AuthState.token; },
    get isLoading() { return AuthState.isLoading; },
    
    // Methods
    register,
    login,
    logout,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    
    // Social auth
    socialLogin,
    
    // 2FA
    setup2FA,
    verify2FA,
    disable2FA,
    
    // Session
    getSessionInfo,
    terminateOtherSessions,
    
    // Middleware
    requireAuth,
    requireGuest,
    
    // UI
    showPasswordResetModal,
    
    // Initialize
    init: initAuth
};

// Make auth globally available
window.auth = auth;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = auth;
}
