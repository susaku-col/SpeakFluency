/* ============================================
   SPEAKFLOW - AUTHENTICATION MODULE
   Version: 1.0.0
   Handles user authentication, registration, and session management
   ============================================ */

// ============================================
// AUTH CONFIGURATION
// ============================================

const AuthConfig = {
    tokenKey: 'speakflow_auth_token',
    userKey: 'speakflow_user',
    refreshTokenKey: 'speakflow_refresh_token',
    tokenExpiryMinutes: 60,
    refreshTokenExpiryDays: 7,
    apiUrl: '/api/auth',
    socialProviders: {
        google: {
            clientId: 'YOUR_GOOGLE_CLIENT_ID',
            scope: 'email profile',
            redirectUri: `${window.location.origin}/auth/google/callback`
        },
        github: {
            clientId: 'YOUR_GITHUB_CLIENT_ID',
            scope: 'user:email',
            redirectUri: `${window.location.origin}/auth/github/callback`
        }
    }
};

// ============================================
// AUTH STATE MANAGEMENT
// ============================================

class AuthState {
    constructor() {
        this.state = {
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            sessionExpiry: null,
            twoFactorRequired: false,
            twoFactorMethod: null
        };
        
        this.listeners = new Map();
        this.init();
    }
    
    init() {
        this.loadStoredSession();
        this.setupTokenRefresh();
        this.setupActivityMonitor();
    }
    
    loadStoredSession() {
        const token = localStorage.getItem(AuthConfig.tokenKey);
        const user = localStorage.getItem(AuthConfig.userKey);
        
        if (token && user) {
            try {
                this.state.user = JSON.parse(user);
                this.state.isAuthenticated = true;
                this.state.sessionExpiry = this.getTokenExpiry();
                this.trigger('sessionRestored', this.state.user);
            } catch (e) {
                console.error('Failed to restore session:', e);
                this.clearSession();
            }
        }
    }
    
    getTokenExpiry() {
        const token = localStorage.getItem(AuthConfig.tokenKey);
        if (!token) return null;
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp ? new Date(payload.exp * 1000) : null;
        } catch (e) {
            return null;
        }
    }
    
    setupTokenRefresh() {
        setInterval(() => {
            if (this.state.isAuthenticated && this.state.sessionExpiry) {
                const timeUntilExpiry = this.state.sessionExpiry - new Date();
                // Refresh token 5 minutes before expiry
                if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
                    this.refreshToken();
                }
            }
        }, 60 * 1000); // Check every minute
    }
    
    setupActivityMonitor() {
        let activityTimeout;
        const resetTimeout = () => {
            clearTimeout(activityTimeout);
            activityTimeout = setTimeout(() => this.checkActivity(), 30 * 60 * 1000);
        };
        
        ['click', 'keypress', 'mousemove', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimeout);
        });
        
        resetTimeout();
    }
    
    checkActivity() {
        if (this.state.isAuthenticated) {
            this.trigger('inactivityWarning');
        }
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
    }
    
    trigger(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => callback(data));
    }
    
    setState(key, value) {
        this.state[key] = value;
        this.trigger('stateChange', { key, value });
    }
    
    clearSession() {
        localStorage.removeItem(AuthConfig.tokenKey);
        localStorage.removeItem(AuthConfig.userKey);
        localStorage.removeItem(AuthConfig.refreshTokenKey);
        
        this.state.user = null;
        this.state.isAuthenticated = false;
        this.state.sessionExpiry = null;
        this.state.twoFactorRequired = false;
        
        this.trigger('sessionCleared');
    }
}

// ============================================
// AUTH SERVICE
// ============================================

class AuthService {
    constructor(authState) {
        this.state = authState;
        this.setupInterceptors();
    }
    
    setupInterceptors() {
        // Add auth header to all fetch requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const token = localStorage.getItem(AuthConfig.tokenKey);
            if (token && args[1]) {
                args[1].headers = {
                    ...args[1].headers,
                    'Authorization': `Bearer ${token}`
                };
            }
            
            const response = await originalFetch(...args);
            
            // Handle unauthorized response
            if (response.status === 401) {
                this.state.clearSession();
                this.state.trigger('unauthorized');
            }
            
            return response;
        };
    }
    
    async login(email, password, rememberMe = false) {
        this.state.setState('isLoading', true);
        this.state.setState('error', null);
        
        try {
            const response = await fetch(`${AuthConfig.apiUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, rememberMe })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }
            
            // Check if 2FA is required
            if (data.requiresTwoFactor) {
                this.state.setState('twoFactorRequired', true);
                this.state.setState('twoFactorMethod', data.twoFactorMethod);
                this.state.trigger('twoFactorRequired', data);
                return { requiresTwoFactor: true };
            }
            
            // Store tokens and user data
            this.storeSession(data);
            
            this.state.setState('isAuthenticated', true);
            this.state.setState('user', data.user);
            this.state.setState('isLoading', false);
            this.state.trigger('loginSuccess', data.user);
            
            return { success: true, user: data.user };
            
        } catch (error) {
            this.state.setState('error', error.message);
            this.state.setState('isLoading', false);
            this.state.trigger('loginError', error.message);
            return { success: false, error: error.message };
        }
    }
    
    async register(userData) {
        this.state.setState('isLoading', true);
        this.state.setState('error', null);
        
        try {
            const response = await fetch(`${AuthConfig.apiUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }
            
            // Auto-login after registration
            this.storeSession(data);
            
            this.state.setState('isAuthenticated', true);
            this.state.setState('user', data.user);
            this.state.setState('isLoading', false);
            this.state.trigger('registerSuccess', data.user);
            
            return { success: true, user: data.user };
            
        } catch (error) {
            this.state.setState('error', error.message);
            this.state.setState('isLoading', false);
            this.state.trigger('registerError', error.message);
            return { success: false, error: error.message };
        }
    }
    
    async verifyTwoFactor(code, method) {
        this.state.setState('isLoading', true);
        
        try {
            const response = await fetch(`${AuthConfig.apiUrl}/verify-2fa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, method })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Verification failed');
            }
            
            this.storeSession(data);
            
            this.state.setState('isAuthenticated', true);
            this.state.setState('user', data.user);
            this.state.setState('twoFactorRequired', false);
            this.state.setState('isLoading', false);
            this.state.trigger('twoFactorVerified', data.user);
            
            return { success: true, user: data.user };
            
        } catch (error) {
            this.state.setState('error', error.message);
            this.state.setState('isLoading', false);
            return { success: false, error: error.message };
        }
    }
    
    async logout() {
        const token = localStorage.getItem(AuthConfig.tokenKey);
        
        if (token) {
            try {
                await fetch(`${AuthConfig.apiUrl}/logout`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error('Logout API call failed:', e);
            }
        }
        
        this.state.clearSession();
        this.state.trigger('logoutSuccess');
        
        return { success: true };
    }
    
    async refreshToken() {
        const refreshToken = localStorage.getItem(AuthConfig.refreshTokenKey);
        if (!refreshToken) return false;
        
        try {
            const response = await fetch(`${AuthConfig.apiUrl}/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error('Token refresh failed');
            }
            
            this.storeTokens(data);
            this.state.trigger('tokenRefreshed');
            
            return true;
            
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.state.clearSession();
            return false;
        }
    }
    
    async resetPassword(email) {
        this.state.setState('isLoading', true);
        
        try {
            const response = await fetch(`${AuthConfig.apiUrl}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            this.state.setState('isLoading', false);
            
            if (!response.ok) {
                throw new Error(data.message || 'Password reset failed');
            }
            
            this.state.trigger('passwordResetSent', { email });
            return { success: true };
            
        } catch (error) {
            this.state.setState('error', error.message);
            this.state.setState('isLoading', false);
            return { success: false, error: error.message };
        }
    }
    
    async updatePassword(currentPassword, newPassword) {
        this.state.setState('isLoading', true);
        
        try {
            const response = await fetch(`${AuthConfig.apiUrl}/update-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem(AuthConfig.tokenKey)}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            const data = await response.json();
            
            this.state.setState('isLoading', false);
            
            if (!response.ok) {
                throw new Error(data.message || 'Password update failed');
            }
            
            this.state.trigger('passwordUpdated');
            return { success: true };
            
        } catch (error) {
            this.state.setState('error', error.message);
            this.state.setState('isLoading', false);
            return { success: false, error: error.message };
        }
    }
    
    async socialLogin(provider, code) {
        this.state.setState('isLoading', true);
        
        try {
            const response = await fetch(`${AuthConfig.apiUrl}/social/${provider}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `${provider} login failed`);
            }
            
            this.storeSession(data);
            
            this.state.setState('isAuthenticated', true);
            this.state.setState('user', data.user);
            this.state.setState('isLoading', false);
            this.state.trigger('socialLoginSuccess', { provider, user: data.user });
            
            return { success: true, user: data.user };
            
        } catch (error) {
            this.state.setState('error', error.message);
            this.state.setState('isLoading', false);
            return { success: false, error: error.message };
        }
    }
    
    storeSession(data) {
        if (data.token) {
            localStorage.setItem(AuthConfig.tokenKey, data.token);
        }
        if (data.refreshToken) {
            localStorage.setItem(AuthConfig.refreshTokenKey, data.refreshToken);
        }
        if (data.user) {
            localStorage.setItem(AuthConfig.userKey, JSON.stringify(data.user));
        }
    }
    
    storeTokens(data) {
        if (data.token) {
            localStorage.setItem(AuthConfig.tokenKey, data.token);
        }
        if (data.refreshToken) {
            localStorage.setItem(AuthConfig.refreshTokenKey, data.refreshToken);
        }
    }
    
    getCurrentUser() {
        return this.state.state.user;
    }
    
    isAuthenticated() {
        return this.state.state.isAuthenticated;
    }
    
    getToken() {
        return localStorage.getItem(AuthConfig.tokenKey);
    }
}

// ============================================
// SOCIAL AUTH PROVIDERS
// ============================================

class SocialAuth {
    constructor(authService) {
        this.auth = authService;
    }
    
    loginWithGoogle() {
        const clientId = AuthConfig.socialProviders.google.clientId;
        const redirectUri = AuthConfig.socialProviders.google.redirectUri;
        const scope = AuthConfig.socialProviders.google.scope;
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${redirectUri}&` +
            `response_type=code&` +
            `scope=${scope}&` +
            `access_type=offline`;
        
        window.location.href = authUrl;
    }
    
    loginWithGithub() {
        const clientId = AuthConfig.socialProviders.github.clientId;
        const redirectUri = AuthConfig.socialProviders.github.redirectUri;
        const scope = AuthConfig.socialProviders.github.scope;
        
        const authUrl = `https://github.com/login/oauth/authorize?` +
            `client_id=${clientId}&` +
            `redirect_uri=${redirectUri}&` +
            `scope=${scope}`;
        
        window.location.href = authUrl;
    }
    
    async handleCallback(provider, code) {
        return await this.auth.socialLogin(provider, code);
    }
}

// ============================================
// AUTH UI CONTROLLER
// ============================================

class AuthUIController {
    constructor(authState, authService) {
        this.state = authState;
        this.auth = authService;
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.setupStateListeners();
    }
    
    bindElements() {
        this.elements = {
            loginForm: document.getElementById('loginForm'),
            registerForm: document.getElementById('registerForm'),
            loginEmail: document.getElementById('loginEmail'),
            loginPassword: document.getElementById('loginPassword'),
            registerName: document.getElementById('regName'),
            registerEmail: document.getElementById('regEmail'),
            registerPassword: document.getElementById('regPassword'),
            authModal: document.getElementById('authModal'),
            loginBtn: document.getElementById('doLoginBtn'),
            registerBtn: document.getElementById('doRegisterBtn'),
            googleBtn: document.getElementById('googleLogin'),
            githubBtn: document.getElementById('githubLogin'),
            forgotPassword: document.getElementById('forgotPassword'),
            showRegister: document.getElementById('showRegister'),
            showLogin: document.getElementById('showLogin'),
            authError: document.getElementById('authError'),
            authLoading: document.getElementById('authLoading')
        };
    }
    
    bindEvents() {
        if (this.elements.loginBtn) {
            this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
        }
        
        if (this.elements.registerBtn) {
            this.elements.registerBtn.addEventListener('click', () => this.handleRegister());
        }
        
        if (this.elements.googleBtn) {
            this.elements.googleBtn.addEventListener('click', () => this.handleGoogleLogin());
        }
        
        if (this.elements.githubBtn) {
            this.elements.githubBtn.addEventListener('click', () => this.handleGithubLogin());
        }
        
        if (this.elements.showRegister) {
            this.elements.showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterForm();
            });
        }
        
        if (this.elements.showLogin) {
            this.elements.showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginForm();
            });
        }
        
        if (this.elements.forgotPassword) {
            this.elements.forgotPassword.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleForgotPassword();
            });
        }
        
        // Enter key submission
        const inputs = ['loginEmail', 'loginPassword', 'registerName', 'registerEmail', 'registerPassword'];
        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        if (inputId.includes('login')) {
                            this.handleLogin();
                        } else if (inputId.includes('register')) {
                            this.handleRegister();
                        }
                    }
                });
            }
        });
    }
    
    setupStateListeners() {
        this.state.on('stateChange', (data) => {
            if (data.key === 'isLoading') {
                this.updateLoadingState(data.value);
            }
            if (data.key === 'error') {
                this.showError(data.value);
            }
        });
        
        this.state.on('loginSuccess', (user) => {
            this.closeAuthModal();
            this.showSuccess(`Welcome back, ${user.name || user.email}!`);
        });
        
        this.state.on('registerSuccess', (user) => {
            this.closeAuthModal();
            this.showSuccess(`Welcome to SpeakFlow, ${user.name}! Please complete your onboarding.`);
            this.showOnboarding();
        });
        
        this.state.on('logoutSuccess', () => {
            this.showSuccess('Logged out successfully');
        });
    }
    
    async handleLogin() {
        const email = this.elements.loginEmail?.value;
        const password = this.elements.loginPassword?.value;
        
        if (!email || !password) {
            this.showError('Please enter email and password');
            return;
        }
        
        if (!this.validateEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }
        
        const result = await this.auth.login(email, password);
        
        if (result.success) {
            // Trigger custom event for other modules
            const event = new CustomEvent('auth:login', { detail: result.user });
            document.dispatchEvent(event);
        }
    }
    
    async handleRegister() {
        const name = this.elements.registerName?.value;
        const email = this.elements.registerEmail?.value;
        const password = this.elements.registerPassword?.value;
        
        if (!name || !email || !password) {
            this.showError('Please fill in all fields');
            return;
        }
        
        if (!this.validateEmail(email)) {
            this.showError('Please enter a valid email address');
            return;
        }
        
        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }
        
        const userData = { name, email, password };
        const result = await this.auth.register(userData);
        
        if (result.success) {
            const event = new CustomEvent('auth:register', { detail: result.user });
            document.dispatchEvent(event);
        }
    }
    
    async handleGoogleLogin() {
        const socialAuth = new SocialAuth(this.auth);
        socialAuth.loginWithGoogle();
    }
    
    async handleGithubLogin() {
        const socialAuth = new SocialAuth(this.auth);
        socialAuth.loginWithGithub();
    }
    
    async handleForgotPassword() {
        const email = prompt('Enter your email address to reset password:');
        if (email && this.validateEmail(email)) {
            const result = await this.auth.resetPassword(email);
            if (result.success) {
                alert('Password reset link sent to your email!');
            } else {
                alert(result.error);
            }
        } else if (email) {
            alert('Please enter a valid email address');
        }
    }
    
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    showLoginForm() {
        if (this.elements.loginForm) this.elements.loginForm.style.display = 'block';
        if (this.elements.registerForm) this.elements.registerForm.style.display = 'none';
        if (this.elements.authTitle) this.elements.authTitle.textContent = 'Login to SpeakFlow';
    }
    
    showRegisterForm() {
        if (this.elements.loginForm) this.elements.loginForm.style.display = 'none';
        if (this.elements.registerForm) this.elements.registerForm.style.display = 'block';
        if (this.elements.authTitle) this.elements.authTitle.textContent = 'Create Account';
    }
    
    openAuthModal() {
        if (this.elements.authModal) {
            this.elements.authModal.classList.add('active');
            this.showLoginForm();
        }
    }
    
    closeAuthModal() {
        if (this.elements.authModal) {
            this.elements.authModal.classList.remove('active');
        }
    }
    
    updateLoadingState(isLoading) {
        if (this.elements.authLoading) {
            this.elements.authLoading.style.display = isLoading ? 'flex' : 'none';
        }
        
        const buttons = [this.elements.loginBtn, this.elements.registerBtn];
        buttons.forEach(btn => {
            if (btn) btn.disabled = isLoading;
        });
    }
    
    showError(message) {
        if (this.elements.authError) {
            this.elements.authError.textContent = message;
            this.elements.authError.style.display = 'block';
            
            setTimeout(() => {
                if (this.elements.authError) {
                    this.elements.authError.style.display = 'none';
                }
            }, 5000);
        } else {
            alert(message);
        }
    }
    
    showSuccess(message) {
        const toast = document.createElement('div');
        toast.className = 'toast toast-success';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
    
    showOnboarding() {
        const onboardingModal = document.getElementById('onboardingModal');
        if (onboardingModal) {
            onboardingModal.classList.add('active');
        }
    }
    
    logout() {
        this.auth.logout();
        const event = new CustomEvent('auth:logout');
        document.dispatchEvent(event);
    }
}

// ============================================
// SESSION MANAGER
// ============================================

class SessionManager {
    constructor(authState, authService) {
        this.state = authState;
        this.auth = authService;
        this.init();
    }
    
    init() {
        this.checkSessionValidity();
        this.setupSessionHeartbeat();
    }
    
    checkSessionValidity() {
        const expiry = this.state.state.sessionExpiry;
        if (expiry && expiry < new Date()) {
            this.auth.refreshToken();
        }
    }
    
    setupSessionHeartbeat() {
        setInterval(() => {
            if (this.state.state.isAuthenticated) {
                this.sendHeartbeat();
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }
    
    async sendHeartbeat() {
        try {
            const response = await fetch(`${AuthConfig.apiUrl}/heartbeat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });
            
            if (!response.ok) {
                console.warn('Heartbeat failed');
            }
        } catch (error) {
            console.error('Heartbeat error:', error);
        }
    }
    
    getSessionDuration() {
        if (!this.state.state.sessionExpiry) return null;
        return this.state.state.sessionExpiry - new Date();
    }
    
    isSessionExpiringSoon(minutes = 5) {
        const duration = this.getSessionDuration();
        return duration !== null && duration < minutes * 60 * 1000;
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize auth system
const authState = new AuthState();
const authService = new AuthService(authState);
const authUI = new AuthUIController(authState, authService);
const sessionManager = new SessionManager(authState, authService);

// Global exports for browser
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.Auth = {
    state: authState,
    service: authService,
    ui: authUI,
    session: sessionManager,
    SocialAuth: SocialAuth
};

// Module exports for bundlers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AuthConfig,
        AuthState,
        AuthService,
        SocialAuth,
        AuthUIController,
        SessionManager
    };
}

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const provider = urlParams.get('provider');
    
    if (code && provider) {
        const socialAuth = new SocialAuth(authService);
        socialAuth.handleCallback(provider, code).then(result => {
            if (result.success) {
                window.history.replaceState({}, document.title, window.location.pathname);
                authUI.closeAuthModal();
                authUI.showSuccess(`Logged in with ${provider}`);
            } else {
                authUI.showError(result.error);
            }
        });
    }
    
    // Auto-show auth modal if needed
    const requireAuth = document.body.dataset.requireAuth === 'true';
    if (requireAuth && !authService.isAuthenticated()) {
        authUI.openAuthModal();
    }
});
