// ============================================
// SpeakFlow PWA Module
// Progressive Web App Functionality
// ============================================

// ============================================
// PWA State Management
// ============================================

const PWAState = {
    isInitialized: false,
    isInstallable: false,
    isInstalled: false,
    deferredPrompt: null,
    serviceWorker: null,
    subscription: null,
    updateAvailable: false,
    waitingWorker: null,
    isOfflineReady: false
};

// ============================================
// Configuration
// ============================================

const PWA_CONFIG = {
    SW_URL: '/sw.js',
    MANIFEST_URL: '/manifest.json',
    UPDATE_INTERVAL: 60 * 60 * 1000, // 1 hour
    CHECK_ONLINE_INTERVAL: 30000, // 30 seconds
    CACHE_NAME: 'speakflow-v1',
    OFFLINE_URL: '/offline.html'
};

// ============================================
// Service Worker Registration
// ============================================

/**
 * Register service worker
 */
const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service workers not supported');
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.register(PWA_CONFIG.SW_URL, {
            scope: '/'
        });
        
        PWAState.serviceWorker = registration;
        
        console.log('Service Worker registered:', registration);
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            PWAState.updateAvailable = true;
            
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    PWAState.waitingWorker = newWorker;
                    showUpdatePrompt();
                }
            });
        });
        
        // Check for updates periodically
        setInterval(() => {
            registration.update();
        }, PWA_CONFIG.UPDATE_INTERVAL);
        
        return true;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return false;
    }
};

/**
 * Check for service worker updates
 */
const checkForUpdates = async () => {
    if (!PWAState.serviceWorker) return;
    
    try {
        await PWAState.serviceWorker.update();
    } catch (error) {
        console.error('Update check failed:', error);
    }
};

/**
 * Apply pending update
 */
const applyUpdate = () => {
    if (PWAState.waitingWorker) {
        PWAState.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
    }
};

/**
 * Show update prompt
 */
const showUpdatePrompt = () => {
    const prompt = document.createElement('div');
    prompt.className = 'update-prompt';
    prompt.innerHTML = `
        <div class="update-content">
            <span class="update-icon">🔄</span>
            <div class="update-text">
                <strong>Update Available!</strong>
                <p>A new version is ready. Refresh to get the latest features.</p>
            </div>
            <button class="btn btn-primary btn-sm" onclick="pwa.applyUpdate()">Refresh</button>
            <button class="update-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    document.body.appendChild(prompt);
    
    setTimeout(() => {
        prompt.classList.add('show');
    }, 100);
};

// ============================================
// Installation Handling
// ============================================

/**
 * Handle beforeinstallprompt event
 */
const handleBeforeInstallPrompt = (event) => {
    event.preventDefault();
    PWAState.deferredPrompt = event;
    PWAState.isInstallable = true;
    
    // Show install banner
    showInstallBanner();
};

/**
 * Show install banner
 */
const showInstallBanner = () => {
    // Check if banner was dismissed
    if (localStorage.getItem('install_banner_dismissed')) return;
    
    // Check if already installed
    if (PWAState.isInstalled) return;
    
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
        <div class="install-content">
            <div class="install-icon">📱</div>
            <div class="install-text">
                <strong>Install SpeakFlow App</strong>
                <p>Get a better experience with our native app</p>
            </div>
            <div class="install-buttons">
                <button class="btn btn-primary btn-sm" id="install-btn">Install</button>
                <button class="btn btn-outline btn-sm" id="dismiss-btn">Not Now</button>
            </div>
            <button class="install-close" id="close-banner">&times;</button>
        </div>
    `;
    
    document.body.appendChild(banner);
    
    const installBtn = banner.querySelector('#install-btn');
    const dismissBtn = banner.querySelector('#dismiss-btn');
    const closeBtn = banner.querySelector('#close-banner');
    
    installBtn.addEventListener('click', () => {
        promptInstall();
        banner.remove();
    });
    
    dismissBtn.addEventListener('click', () => {
        localStorage.setItem('install_banner_dismissed', 'true');
        banner.remove();
    });
    
    closeBtn.addEventListener('click', () => {
        localStorage.setItem('install_banner_dismissed', 'true');
        banner.remove();
    });
    
    setTimeout(() => {
        banner.classList.add('show');
    }, 100);
};

/**
 * Prompt for install
 */
const promptInstall = async () => {
    if (!PWAState.deferredPrompt) {
        showToast('Installation not available', 'info');
        return;
    }
    
    PWAState.deferredPrompt.prompt();
    const result = await PWAState.deferredPrompt.userChoice;
    
    if (result.outcome === 'accepted') {
        console.log('User accepted install');
        PWAState.isInstalled = true;
        showToast('Thank you for installing!', 'success');
    } else {
        console.log('User dismissed install');
    }
    
    PWAState.deferredPrompt = null;
    PWAState.isInstallable = false;
};

/**
 * Check if app is installed
 */
const checkInstalled = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        PWAState.isInstalled = true;
    } else if (window.navigator.standalone === true) {
        PWAState.isInstalled = true;
    }
    
    // Update UI based on install status
    const installBtn = document.getElementById('install-app-btn');
    if (installBtn) {
        installBtn.style.display = PWAState.isInstalled ? 'none' : 'block';
    }
};

// ============================================
// Push Notifications
// ============================================

/**
 * Request notification permission
 */
const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return false;
    }
    
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        await subscribeToPush();
        showToast('Notifications enabled!', 'success');
        return true;
    } else {
        showToast('Notifications disabled', 'info');
        return false;
    }
};

/**
 * Subscribe to push notifications
 */
const subscribeToPush = async () => {
    if (!PWAState.serviceWorker) return null;
    
    try {
        const subscription = await PWAState.serviceWorker.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.VAPID_PUBLIC_KEY)
        });
        
        PWAState.subscription = subscription;
        
        // Send subscription to server
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify(subscription)
        });
        
        return subscription;
    } catch (error) {
        console.error('Push subscription failed:', error);
        return null;
    }
};

/**
 * Unsubscribe from push notifications
 */
const unsubscribeFromPush = async () => {
    if (!PWAState.subscription) return;
    
    try {
        await PWAState.subscription.unsubscribe();
        
        await fetch('/api/notifications/unsubscribe', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            },
            body: JSON.stringify({ endpoint: PWAState.subscription.endpoint })
        });
        
        PWAState.subscription = null;
        showToast('Notifications disabled', 'info');
    } catch (error) {
        console.error('Unsubscribe failed:', error);
    }
};

/**
 * Convert base64 to Uint8Array for VAPID
 */
const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

/**
 * Send test notification
 */
const sendTestNotification = async () => {
    if (!PWAState.subscription) {
        showToast('Enable notifications first', 'warning');
        return;
    }
    
    try {
        await fetch('/api/notifications/test', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        showToast('Test notification sent!', 'success');
    } catch (error) {
        console.error('Test notification failed:', error);
    }
};

// ============================================
// Offline Support
// ============================================

/**
 * Check offline readiness
 */
const checkOfflineReadiness = async () => {
    if (!navigator.onLine) {
        showOfflineReady();
        return;
    }
    
    // Check if critical assets are cached
    const cache = await caches.open(PWA_CONFIG.CACHE_NAME);
    const cachedIndex = await cache.match('/index.html');
    
    if (cachedIndex) {
        PWAState.isOfflineReady = true;
    } else {
        // Cache critical assets
        await cacheCriticalAssets();
    }
};

/**
 * Cache critical assets
 */
const cacheCriticalAssets = async () => {
    const criticalAssets = [
        '/',
        '/index.html',
        '/offline.html',
        '/css/main.css',
        '/css/components.css',
        '/js/app.js',
        '/manifest.json'
    ];
    
    const cache = await caches.open(PWA_CONFIG.CACHE_NAME);
    await cache.addAll(criticalAssets);
    
    PWAState.isOfflineReady = true;
};

/**
 * Show offline ready message
 */
const showOfflineReady = () => {
    const message = document.createElement('div');
    message.className = 'offline-ready';
    message.innerHTML = `
        <div class="offline-ready-content">
            <span class="offline-icon">📡</span>
            <span>Ready for offline use!</span>
            <button class="offline-close">&times;</button>
        </div>
    `;
    
    document.body.appendChild(message);
    
    const closeBtn = message.querySelector('.offline-close');
    closeBtn.addEventListener('click', () => {
        message.remove();
    });
    
    setTimeout(() => {
        message.classList.add('show');
        setTimeout(() => {
            message.classList.remove('show');
            setTimeout(() => message.remove(), 500);
        }, 5000);
    }, 100);
};

// ============================================
// PWA Installation Check
// ============================================

/**
 * Check if app can be installed
 */
const checkInstallability = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        PWAState.isInstalled = true;
    }
    
    if (window.navigator.standalone === true) {
        PWAState.isInstalled = true;
    }
};

/**
 * Show installation instructions for iOS
 */
const showIOSInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS && !PWAState.isInstalled) {
        const instructions = document.createElement('div');
        instructions.className = 'ios-instructions';
        instructions.innerHTML = `
            <div class="ios-instructions-content">
                <div class="ios-icon">📱</div>
                <h4>Install SpeakFlow App</h4>
                <ol>
                    <li>Tap the Share button <span class="share-icon">⎙</span></li>
                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                    <li>Tap <strong>"Add"</strong> in the top right corner</li>
                </ol>
                <button class="btn btn-outline btn-sm" id="close-instructions">Got it</button>
            </div>
        `;
        
        document.body.appendChild(instructions);
        
        const closeBtn = instructions.querySelector('#close-instructions');
        closeBtn.addEventListener('click', () => {
            instructions.classList.remove('show');
            setTimeout(() => instructions.remove(), 300);
            localStorage.setItem('ios_instructions_shown', 'true');
        });
        
        setTimeout(() => {
            instructions.classList.add('show');
        }, 100);
    }
};

// ============================================
// PWA Dashboard UI
// ============================================

/**
 * Render PWA settings dashboard
 */
const renderPWADashboard = () => {
    const container = document.getElementById('pwa-dashboard');
    if (!container) return;
    
    container.innerHTML = `
        <div class="pwa-settings">
            <h3>Progressive Web App Settings</h3>
            
            <div class="settings-section">
                <h4>Installation</h4>
                <div class="settings-item">
                    <div>
                        <div class="settings-label">Install App</div>
                        <div class="settings-description">Install SpeakFlow as a native app on your device</div>
                    </div>
                    <button class="btn btn-primary" id="install-pwa-btn" ${PWAState.isInstalled ? 'disabled' : ''}>
                        ${PWAState.isInstalled ? 'Installed ✓' : 'Install App'}
                    </button>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Notifications</h4>
                <div class="settings-item">
                    <div>
                        <div class="settings-label">Push Notifications</div>
                        <div class="settings-description">Receive learning reminders and updates</div>
                    </div>
                    <div>
                        <label class="switch">
                            <input type="checkbox" id="notifications-toggle" ${PWAState.subscription ? 'checked' : ''}>
                            <span class="switch-slider"></span>
                        </label>
                    </div>
                </div>
                <div class="settings-item">
                    <button class="btn btn-outline" id="test-notification-btn">Send Test Notification</button>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Offline Storage</h4>
                <div class="settings-item">
                    <div>
                        <div class="settings-label">Offline Mode</div>
                        <div class="settings-description">Access lessons and practice offline</div>
                    </div>
                    <div>
                        <span class="status-badge ${PWAState.isOfflineReady ? 'success' : 'warning'}">
                            ${PWAState.isOfflineReady ? 'Ready' : 'Preparing...'}
                        </span>
                    </div>
                </div>
                <div class="settings-item">
                    <button class="btn btn-outline" id="cache-lessons-btn">Download Lessons for Offline</button>
                    <button class="btn btn-outline" id="clear-cache-btn">Clear Cache</button>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>App Info</h4>
                <div class="settings-item">
                    <div>
                        <div class="settings-label">Version</div>
                        <div class="settings-description">Current app version</div>
                    </div>
                    <div>1.0.0</div>
                </div>
                <div class="settings-item">
                    <div>
                        <div class="settings-label">Service Worker</div>
                        <div class="settings-description">Status of service worker</div>
                    </div>
                    <div>
                        <span class="status-badge ${PWAState.serviceWorker ? 'success' : 'error'}">
                            ${PWAState.serviceWorker ? 'Active' : 'Not Registered'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Setup event listeners
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) {
        installBtn.addEventListener('click', promptInstall);
    }
    
    const notificationsToggle = document.getElementById('notifications-toggle');
    if (notificationsToggle) {
        notificationsToggle.addEventListener('change', async (e) => {
            if (e.target.checked) {
                await requestNotificationPermission();
            } else {
                await unsubscribeFromPush();
            }
        });
    }
    
    const testNotificationBtn = document.getElementById('test-notification-btn');
    if (testNotificationBtn) {
        testNotificationBtn.addEventListener('click', sendTestNotification);
    }
    
    const cacheLessonsBtn = document.getElementById('cache-lessons-btn');
    if (cacheLessonsBtn) {
        cacheLessonsBtn.addEventListener('click', cacheLessonsForOffline);
    }
    
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearAppCache);
    }
};

/**
 * Cache lessons for offline use
 */
const cacheLessonsForOffline = async () => {
    showToast('Downloading lessons for offline use...', 'info');
    
    try {
        const response = await fetch('/api/lessons', {
            headers: {
                'Authorization': `Bearer ${auth?.token || ''}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && window.offline) {
            for (const lesson of data.data) {
                await window.offline.saveLessonOffline(lesson);
            }
            showToast('Lessons downloaded successfully!', 'success');
        }
    } catch (error) {
        console.error('Cache lessons error:', error);
        showToast('Failed to download lessons', 'error');
    }
};

/**
 * Clear app cache
 */
const clearAppCache = async () => {
    if (confirm('Clear app cache? You may need to reload the page.')) {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            showToast('Cache cleared! Reloading...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        }
    }
};

// ============================================
// Badge API (for unread count)
// ============================================

/**
 * Set app badge count
 */
const setBadgeCount = async (count) => {
    if ('setAppBadge' in navigator) {
        if (count > 0) {
            await navigator.setAppBadge(count);
        } else {
            await navigator.clearAppBadge();
        }
    }
};

/**
 * Update badge from notification count
 */
const updateBadgeFromNotifications = () => {
    const unreadCount = window.support?.unreadCount || 0;
    setBadgeCount(unreadCount);
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize PWA module
 */
const initPWA = async () => {
    if (PWAState.isInitialized) return;
    
    console.log('Initializing PWA module...');
    
    // Check installability
    checkInstallability();
    
    // Register service worker
    await registerServiceWorker();
    
    // Check offline readiness
    await checkOfflineReadiness();
    
    // Setup event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
        PWAState.isInstalled = true;
        PWAState.deferredPrompt = null;
        showToast('App installed successfully!', 'success');
    });
    
    // Check for iOS
    if (!localStorage.getItem('ios_instructions_shown')) {
        showIOSInstructions();
    }
    
    // Setup periodic badge update
    setInterval(updateBadgeFromNotifications, 60000);
    
    PWAState.isInitialized = true;
    
    console.log('PWA module initialized');
};

// ============================================
// Export PWA Module
// ============================================

const pwa = {
    // State
    get isInstallable() { return PWAState.isInstallable; },
    get isInstalled() { return PWAState.isInstalled; },
    get updateAvailable() { return PWAState.updateAvailable; },
    get isOfflineReady() { return PWAState.isOfflineReady; },
    
    // Installation
    promptInstall,
    checkInstallability,
    
    // Updates
    checkForUpdates,
    applyUpdate,
    
    // Notifications
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
    
    // Offline
    checkOfflineReadiness,
    cacheLessonsForOffline,
    clearAppCache,
    
    // Badge
    setBadgeCount,
    
    // UI
    renderPWADashboard,
    
    // Initialize
    init: initPWA
};

// Make pwa globally available
window.pwa = pwa;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWA);
} else {
    initPWA();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = pwa;
}
