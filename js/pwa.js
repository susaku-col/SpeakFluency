/* ============================================
   SPEAKFLOW - PWA MODULE
   Version: 1.0.0
   Handles PWA installation, updates, and offline capabilities
   ============================================ */

// ============================================
// PWA CONFIGURATION
// ============================================

const PWAConfig = {
    // App Metadata
    app: {
        name: 'SpeakFlow',
        shortName: 'SpeakFlow',
        description: 'AI English Speaking Coach',
        themeColor: '#3b82f6',
        backgroundColor: '#ffffff',
        scope: '/',
        startUrl: '/'
    },
    
    // Service Worker
    sw: {
        url: '/sw.js',
        scope: '/',
        updateInterval: 3600000, // 1 hour
        skipWaiting: true
    },
    
    // Installation
    install: {
        promptDelay: 30000, // 30 seconds after page load
        maxPrompts: 3,
        promptCooldown: 7 * 24 * 3600000 // 7 days
    },
    
    // Update
    update: {
        checkInterval: 3600000, // 1 hour
        autoReload: true,
        reloadDelay: 5000 // 5 seconds
    },
    
    // Storage Keys
    storage: {
        installPromptCount: 'pwa_install_prompt_count',
        lastPromptDate: 'pwa_last_prompt_date',
        updateAvailable: 'pwa_update_available'
    }
};

// ============================================
// PWA INSTALLATION MANAGER
// ============================================

class PWAInstallManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.promptCount = this.loadPromptCount();
        this.lastPromptDate = this.loadLastPromptDate();
        this.init();
    }
    
    init() {
        this.checkInstallation();
        this.setupBeforeInstallPrompt();
        this.setupAppInstalled();
        this.showInstallPromptIfNeeded();
    }
    
    loadPromptCount() {
        const count = localStorage.getItem(PWAConfig.storage.installPromptCount);
        return count ? parseInt(count) : 0;
    }
    
    savePromptCount() {
        localStorage.setItem(PWAConfig.storage.installPromptCount, this.promptCount.toString());
    }
    
    loadLastPromptDate() {
        const date = localStorage.getItem(PWAConfig.storage.lastPromptDate);
        return date ? new Date(parseInt(date)) : null;
    }
    
    saveLastPromptDate() {
        localStorage.setItem(PWAConfig.storage.lastPromptDate, Date.now().toString());
    }
    
    checkInstallation() {
        // Check if app is already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                            window.navigator.standalone === true;
        
        this.isInstalled = isStandalone;
        
        if (this.isInstalled) {
            const event = new CustomEvent('pwa:installed', {
                detail: { isInstalled: true }
            });
            document.dispatchEvent(event);
        }
        
        return this.isInstalled;
    }
    
    setupBeforeInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            
            // Check if we should show the prompt
            if (this.shouldShowPrompt()) {
                this.showInstallPrompt();
            }
            
            // Dispatch event for UI
            const event = new CustomEvent('pwa:installAvailable', {
                detail: { canInstall: true }
            });
            document.dispatchEvent(event);
        });
    }
    
    setupAppInstalled() {
        window.addEventListener('appinstalled', (e) => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            
            const event = new CustomEvent('pwa:installed', {
                detail: { isInstalled: true, timestamp: new Date() }
            });
            document.dispatchEvent(event);
            
            // Track installation
            this.trackInstallation();
        });
    }
    
    shouldShowPrompt() {
        // Don't show if already installed
        if (this.isInstalled) return false;
        
        // Don't show if max prompts reached
        if (this.promptCount >= PWAConfig.install.maxPrompts) return false;
        
        // Don't show if on cooldown
        if (this.lastPromptDate) {
            const cooldownEnd = new Date(this.lastPromptDate.getTime() + PWAConfig.install.promptCooldown);
            if (new Date() < cooldownEnd) return false;
        }
        
        return true;
    }
    
    showInstallPrompt() {
        if (!this.deferredPrompt) return;
        
        // Show the prompt
        this.deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        this.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                this.trackPromptResult('accepted');
            } else {
                console.log('User dismissed the install prompt');
                this.trackPromptResult('dismissed');
            }
            
            this.deferredPrompt = null;
        });
        
        // Update prompt tracking
        this.promptCount++;
        this.savePromptCount();
        this.saveLastPromptDate();
    }
    
    showInstallPromptIfNeeded() {
        // Show prompt after delay if conditions are met
        setTimeout(() => {
            if (this.shouldShowPrompt() && this.deferredPrompt) {
                this.showInstallPrompt();
            }
        }, PWAConfig.install.promptDelay);
    }
    
    manualInstall() {
        if (this.deferredPrompt) {
            this.showInstallPrompt();
        } else {
            // Fallback: show instructions
            this.showInstallInstructions();
        }
    }
    
    showInstallInstructions() {
        const modal = document.createElement('div');
        modal.className = 'pwa-install-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Install SpeakFlow App</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Install SpeakFlow on your device for the best experience:</p>
                    <div class="install-instructions">
                        <div class="instruction">
                            <div class="instruction-icon">📱</div>
                            <div class="instruction-text">
                                <strong>On Android:</strong>
                                <ol>
                                    <li>Tap the menu icon (⋮)</li>
                                    <li>Select "Install App" or "Add to Home Screen"</li>
                                    <li>Follow the prompts to install</li>
                                </ol>
                            </div>
                        </div>
                        <div class="instruction">
                            <div class="instruction-icon">🍎</div>
                            <div class="instruction-text">
                                <strong>On iOS:</strong>
                                <ol>
                                    <li>Tap the share icon (⎔)</li>
                                    <li>Select "Add to Home Screen"</li>
                                    <li>Tap "Add" in the top right</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary close-modal">Got it</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeModal = () => modal.remove();
        modal.querySelectorAll('.modal-close, .close-modal').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    }
    
    trackPromptResult(result) {
        // Analytics tracking
        console.log(`[PWA] Install prompt ${result}`);
        
        const event = new CustomEvent('pwa:promptResult', {
            detail: { result, promptCount: this.promptCount }
        });
        document.dispatchEvent(event);
    }
    
    trackInstallation() {
        console.log('[PWA] App installed');
        
        const event = new CustomEvent('pwa:installationTracked', {
            detail: { timestamp: new Date() }
        });
        document.dispatchEvent(event);
    }
    
    canInstall() {
        return this.deferredPrompt !== null && !this.isInstalled;
    }
}

// ============================================
// SERVICE WORKER MANAGER
// ============================================

class ServiceWorkerManager {
    constructor() {
        this.registration = null;
        this.updateAvailable = false;
        this.waitingWorker = null;
        this.init();
    }
    
    init() {
        this.register();
        this.setupUpdateCheck();
        this.setupMessageListener();
    }
    
    async register() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return;
        }
        
        try {
            this.registration = await navigator.serviceWorker.register(PWAConfig.sw.url, {
                scope: PWAConfig.sw.scope
            });
            
            console.log('Service Worker registered:', this.registration);
            
            // Check for updates
            this.checkForUpdate();
            
            // Handle waiting worker
            if (this.registration.waiting) {
                this.handleWaitingWorker(this.registration.waiting);
            }
            
            // Handle controller change
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker controller changed');
                window.location.reload();
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    
    setupUpdateCheck() {
        // Check for updates periodically
        setInterval(() => {
            this.checkForUpdate();
        }, PWAConfig.update.checkInterval);
    }
    
    async checkForUpdate() {
        if (!this.registration) return;
        
        try {
            await this.registration.update();
            console.log('Checked for Service Worker update');
        } catch (error) {
            console.error('Failed to check for update:', error);
        }
    }
    
    setupMessageListener() {
        navigator.serviceWorker.addEventListener('message', (event) => {
            const data = event.data;
            
            switch (data.type) {
                case 'UPDATE_AVAILABLE':
                    this.handleUpdateAvailable();
                    break;
                case 'CACHE_STATUS':
                    console.log('Cache status:', data.data);
                    break;
                case 'SYNC_COMPLETE':
                    this.handleSyncComplete(data);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        });
    }
    
    handleUpdateAvailable() {
        this.updateAvailable = true;
        
        const event = new CustomEvent('pwa:updateAvailable', {
            detail: { updateAvailable: true }
        });
        document.dispatchEvent(event);
        
        // Show update notification
        this.showUpdateNotification();
    }
    
    handleWaitingWorker(worker) {
        this.waitingWorker = worker;
        
        worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') {
                console.log('New Service Worker activated');
                window.location.reload();
            }
        });
    }
    
    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'pwa-update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <span class="update-icon">🔄</span>
                <span class="update-text">New version available!</span>
                <button class="update-btn" id="updateNowBtn">Update Now</button>
                <button class="close-btn" id="closeUpdateBtn">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        const updateBtn = notification.querySelector('#updateNowBtn');
        const closeBtn = notification.querySelector('#closeUpdateBtn');
        
        updateBtn?.addEventListener('click', () => {
            this.applyUpdate();
            notification.remove();
        });
        
        closeBtn?.addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
            notification.remove();
        }, 30000);
    }
    
    applyUpdate() {
        if (this.waitingWorker) {
            this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        } else if (this.registration && this.registration.waiting) {
            this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
            window.location.reload();
        }
    }
    
    handleSyncComplete(data) {
        console.log('Sync completed:', data);
        
        const event = new CustomEvent('pwa:syncComplete', {
            detail: data
        });
        document.dispatchEvent(event);
    }
    
    async getCacheStatus() {
        if (!this.registration || !this.registration.active) return null;
        
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (event) => {
                resolve(event.data);
            };
            
            this.registration.active.postMessage(
                { type: 'GET_CACHE_STATUS' },
                [channel.port2]
            );
        });
    }
    
    async clearCache() {
        if (!this.registration || !this.registration.active) return;
        
        this.registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }
}

// ============================================
// OFFLINE SYNC MANAGER
// ============================================

class OfflineSyncManager {
    constructor(swManager) {
        this.swManager = swManager;
        this.syncQueue = [];
        this.isSyncing = false;
        this.init();
    }
    
    init() {
        this.loadQueue();
        this.setupSyncListeners();
        this.setupBackgroundSync();
    }
    
    loadQueue() {
        const saved = localStorage.getItem('pwa_sync_queue');
        if (saved) {
            try {
                this.syncQueue = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load sync queue:', e);
            }
        }
    }
    
    saveQueue() {
        localStorage.setItem('pwa_sync_queue', JSON.stringify(this.syncQueue));
    }
    
    setupSyncListeners() {
        window.addEventListener('online', () => {
            console.log('Online detected, syncing...');
            this.processQueue();
        });
        
        document.addEventListener('pwa:syncComplete', () => {
            this.processQueue();
        });
    }
    
    setupBackgroundSync() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.sync.register('sync-practices').catch(err => {
                    console.error('Background sync registration failed:', err);
                });
            });
        }
    }
    
    addToQueue(data, type) {
        this.syncQueue.push({
            id: this.generateId(),
            type,
            data,
            timestamp: Date.now(),
            attempts: 0
        });
        
        this.saveQueue();
        
        // Process immediately if online
        if (navigator.onLine) {
            this.processQueue();
        }
        
        return true;
    }
    
    async processQueue() {
        if (this.isSyncing) return;
        if (this.syncQueue.length === 0) return;
        if (!navigator.onLine) return;
        
        this.isSyncing = true;
        
        const toProcess = [...this.syncQueue];
        const succeeded = [];
        const failed = [];
        
        for (const item of toProcess) {
            const success = await this.processItem(item);
            
            if (success) {
                succeeded.push(item.id);
            } else {
                item.attempts++;
                if (item.attempts >= 5) {
                    failed.push(item.id);
                }
            }
        }
        
        // Remove succeeded and permanently failed items
        this.syncQueue = this.syncQueue.filter(item => 
            !succeeded.includes(item.id) && !failed.includes(item.id)
        );
        
        this.saveQueue();
        this.isSyncing = false;
        
        // Dispatch event
        const event = new CustomEvent('pwa:queueProcessed', {
            detail: { succeeded: succeeded.length, failed: failed.length, remaining: this.syncQueue.length }
        });
        document.dispatchEvent(event);
    }
    
    async processItem(item) {
        try {
            const response = await fetch(item.data.url, {
                method: item.data.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...item.data.headers
                },
                body: item.data.body ? JSON.stringify(item.data.body) : undefined
            });
            
            return response.ok;
        } catch (error) {
            console.error(`Failed to sync item ${item.id}:`, error);
            return false;
        }
    }
    
    generateId() {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getQueueSize() {
        return this.syncQueue.length;
    }
    
    clearQueue() {
        this.syncQueue = [];
        this.saveQueue();
    }
}

// ============================================
// PWA UI CONTROLLER
// ============================================

class PWAUIController {
    constructor(installManager, swManager, syncManager) {
        this.installManager = installManager;
        this.swManager = swManager;
        this.syncManager = syncManager;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.renderInstallButton();
    }
    
    bindElements() {
        this.elements = {
            installBtn: document.getElementById('installAppBtn'),
            closeInstallBtn: document.getElementById('closeInstallBtn'),
            installPrompt: document.getElementById('pwaInstallPrompt'),
            updateNotification: document.getElementById('updateNotification'),
            offlineStatus: document.getElementById('offlineStatus'),
            syncStatus: document.getElementById('syncStatus')
        };
    }
    
    bindEvents() {
        if (this.elements.installBtn) {
            this.elements.installBtn.addEventListener('click', () => {
                this.installManager.manualInstall();
                this.hideInstallPrompt();
            });
        }
        
        if (this.elements.closeInstallBtn) {
            this.elements.closeInstallBtn.addEventListener('click', () => {
                this.hideInstallPrompt();
            });
        }
        
        document.addEventListener('pwa:installAvailable', (e) => {
            if (e.detail.canInstall) {
                this.showInstallPrompt();
            }
        });
        
        document.addEventListener('pwa:updateAvailable', () => {
            this.showUpdateNotification();
        });
        
        document.addEventListener('pwa:installed', () => {
            this.hideInstallPrompt();
            this.showInstallSuccess();
        });
        
        window.addEventListener('online', () => this.updateOfflineStatus());
        window.addEventListener('offline', () => this.updateOfflineStatus());
    }
    
    renderInstallButton() {
        if (this.elements.installBtn && this.installManager.canInstall()) {
            this.elements.installBtn.style.display = 'block';
        }
    }
    
    showInstallPrompt() {
        if (this.elements.installPrompt) {
            this.elements.installPrompt.style.display = 'block';
        }
    }
    
    hideInstallPrompt() {
        if (this.elements.installPrompt) {
            this.elements.installPrompt.style.display = 'none';
        }
    }
    
    showInstallSuccess() {
        this.showToast('SpeakFlow installed successfully! 🎉', 'success');
    }
    
    showUpdateNotification() {
        if (this.elements.updateNotification) {
            this.elements.updateNotification.style.display = 'block';
            
            const updateBtn = this.elements.updateNotification.querySelector('#updateNowBtn');
            if (updateBtn) {
                updateBtn.addEventListener('click', () => {
                    this.swManager.applyUpdate();
                });
            }
        }
    }
    
    updateOfflineStatus() {
        if (this.elements.offlineStatus) {
            const isOnline = navigator.onLine;
            this.elements.offlineStatus.innerHTML = isOnline ? 'Online' : 'Offline';
            this.elements.offlineStatus.className = isOnline ? 'status-online' : 'status-offline';
        }
        
        if (this.elements.syncStatus) {
            const queueSize = this.syncManager.getQueueSize();
            if (queueSize > 0) {
                this.elements.syncStatus.innerHTML = `${queueSize} items pending sync`;
                this.elements.syncStatus.style.display = 'block';
            } else {
                this.elements.syncStatus.style.display = 'none';
            }
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `pwa-toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize PWA system
const pwaInstallManager = new PWAInstallManager();
const serviceWorkerManager = new ServiceWorkerManager();
const offlineSyncManager = new OfflineSyncManager(serviceWorkerManager);
const pwaUI = new PWAUIController(pwaInstallManager, serviceWorkerManager, offlineSyncManager);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.PWA = {
    install: pwaInstallManager,
    sw: serviceWorkerManager,
    sync: offlineSyncManager,
    ui: pwaUI,
    config: PWAConfig
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PWAConfig,
        PWAInstallManager,
        ServiceWorkerManager,
        OfflineSyncManager,
        PWAUIController
    };
}

// ============================================
// CSS STYLES
// ============================================

const style = document.createElement('style');
style.textContent = `
    .pwa-install-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .pwa-install-modal .modal-content {
        max-width: 500px;
        width: 90%;
    }
    
    .install-instructions {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin: 20px 0;
    }
    
    .instruction {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: var(--bg-secondary);
        border-radius: 12px;
    }
    
    .instruction-icon {
        font-size: 32px;
    }
    
    .instruction-text {
        flex: 1;
    }
    
    .instruction-text ol {
        margin: 8px 0 0 20px;
        padding: 0;
    }
    
    .instruction-text li {
        margin: 4px 0;
    }
    
    .pwa-update-notification {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--color-primary);
        color: white;
        padding: 12px 24px;
        border-radius: 40px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        animation: slideUp 0.3s ease;
    }
    
    .update-content {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .update-icon {
        font-size: 20px;
    }
    
    .update-text {
        font-weight: 500;
    }
    
    .update-btn {
        background: white;
        color: var(--color-primary);
        border: none;
        padding: 6px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-weight: 600;
    }
    
    .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
    }
    
    .pwa-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 40px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideUp 0.3s ease;
    }
    
    .toast-success {
        background: #10b981;
    }
    
    .toast-error {
        background: #ef4444;
    }
    
    .status-online {
        color: #10b981;
    }
    
    .status-offline {
        color: #f59e0b;
    }
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
`;

document.head.appendChild(style);

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('PWA module initialized');
    
    // Debug mode
    if (window.location.hostname === 'localhost') {
        window.debugPWA = {
            install: pwaInstallManager,
            sw: serviceWorkerManager,
            sync: offlineSyncManager
        };
        console.log('PWA debug mode enabled');
    }
});
