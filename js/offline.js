/* ============================================
   SPEAKFLOW - OFFLINE MODULE
   Version: 1.0.0
   Handles offline mode, data synchronization, and cache management
   ============================================ */

// ============================================
// OFFLINE CONFIGURATION
// ============================================

const OfflineConfig = {
    // Cache Settings
    cache: {
        name: 'speakflow-offline-v1',
        maxSize: 50 * 1024 * 1024, // 50MB
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        cleanInterval: 24 * 60 * 60 * 1000 // 1 day
    },
    
    // Sync Settings
    sync: {
        enabled: true,
        interval: 30000, // 30 seconds
        retryAttempts: 5,
        retryDelay: 5000, // 5 seconds
        maxBatchSize: 50
    },
    
    // Data to cache
    dataTypes: {
        vocabulary: 'vocabulary',
        progress: 'progress',
        settings: 'settings',
        lessons: 'lessons',
        achievements: 'achievements'
    },
    
    // Storage Keys
    storage: {
        offlineQueue: 'offline_queue',
        syncStatus: 'sync_status',
        cachedData: 'cached_data',
        lastSync: 'last_sync'
    }
};

// ============================================
// CACHE MANAGER
// ============================================

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheSize = 0;
        this.init();
    }
    
    init() {
        this.loadCache();
        this.startCleanupInterval();
    }
    
    loadCache() {
        const saved = localStorage.getItem(OfflineConfig.storage.cachedData);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.cache = new Map(Object.entries(data));
                this.calculateCacheSize();
            } catch (e) {
                console.error('Failed to load cache:', e);
            }
        }
    }
    
    saveCache() {
        const cacheObj = Object.fromEntries(this.cache);
        localStorage.setItem(OfflineConfig.storage.cachedData, JSON.stringify(cacheObj));
    }
    
    calculateCacheSize() {
        let size = 0;
        for (const [key, value] of this.cache) {
            size += JSON.stringify(value).length * 2; // Approximate size in bytes
        }
        this.cacheSize = size;
        return size;
    }
    
    set(key, value, ttl = OfflineConfig.cache.maxAge) {
        const item = {
            value,
            timestamp: Date.now(),
            ttl,
            size: JSON.stringify(value).length * 2
        };
        
        // Check cache size limit
        if (this.cacheSize + item.size > OfflineConfig.cache.maxSize) {
            this.evictOldItems(item.size);
        }
        
        this.cache.set(key, item);
        this.cacheSize += item.size;
        this.saveCache();
        
        return true;
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // Check if expired
        if (Date.now() - item.timestamp > item.ttl) {
            this.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    delete(key) {
        const item = this.cache.get(key);
        if (item) {
            this.cacheSize -= item.size;
            this.cache.delete(key);
            this.saveCache();
        }
        return true;
    }
    
    clear() {
        this.cache.clear();
        this.cacheSize = 0;
        this.saveCache();
    }
    
    evictOldItems(neededSpace) {
        // Sort items by timestamp (oldest first)
        const items = Array.from(this.cache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        let freedSpace = 0;
        for (const [key, item] of items) {
            if (freedSpace >= neededSpace) break;
            
            freedSpace += item.size;
            this.cache.delete(key);
        }
        
        this.cacheSize -= freedSpace;
        this.saveCache();
    }
    
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupExpired();
        }, OfflineConfig.cache.cleanInterval);
    }
    
    cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, item] of this.cache) {
            if (now - item.timestamp > item.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.calculateCacheSize();
            this.saveCache();
            console.log(`[Cache] Cleaned ${cleaned} expired items`);
        }
    }
    
    getStats() {
        return {
            size: this.cache.size,
            sizeBytes: this.cacheSize,
            sizeMB: (this.cacheSize / (1024 * 1024)).toFixed(2),
            maxSizeMB: (OfflineConfig.cache.maxSize / (1024 * 1024)).toFixed(2)
        };
    }
}

// ============================================
// SYNC MANAGER
// ============================================

class SyncManager {
    constructor(cacheManager) {
        this.cache = cacheManager;
        this.queue = [];
        this.isSyncing = false;
        this.lastSync = null;
        this.syncCallbacks = [];
        this.init();
    }
    
    init() {
        this.loadQueue();
        this.loadLastSync();
        this.startAutoSync();
        this.setupOnlineListener();
    }
    
    loadQueue() {
        const saved = localStorage.getItem(OfflineConfig.storage.offlineQueue);
        if (saved) {
            try {
                this.queue = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load queue:', e);
            }
        }
    }
    
    saveQueue() {
        localStorage.setItem(OfflineConfig.storage.offlineQueue, JSON.stringify(this.queue));
    }
    
    loadLastSync() {
        const saved = localStorage.getItem(OfflineConfig.storage.lastSync);
        if (saved) {
            this.lastSync = new Date(parseInt(saved));
        }
    }
    
    saveLastSync() {
        localStorage.setItem(OfflineConfig.storage.lastSync, this.lastSync?.getTime().toString());
    }
    
    addToQueue(operation) {
        this.queue.push({
            ...operation,
            id: this.generateId(),
            timestamp: Date.now(),
            attempts: 0
        });
        
        this.saveQueue();
        
        // Try to sync immediately if online
        if (navigator.onLine) {
            this.processQueue();
        }
        
        return operation.id;
    }
    
    async processQueue() {
        if (this.isSyncing) return;
        if (this.queue.length === 0) return;
        if (!navigator.onLine) return;
        
        this.isSyncing = true;
        
        // Take a batch from queue
        const batch = this.queue.slice(0, OfflineConfig.sync.maxBatchSize);
        
        console.log(`[Sync] Processing ${batch.length} items...`);
        
        const results = await Promise.allSettled(
            batch.map(operation => this.executeOperation(operation))
        );
        
        // Process results
        const succeeded = [];
        const failed = [];
        
        results.forEach((result, index) => {
            const operation = batch[index];
            if (result.status === 'fulfilled' && result.value) {
                succeeded.push(operation.id);
            } else {
                failed.push(operation);
            }
        });
        
        // Remove succeeded operations
        this.queue = this.queue.filter(op => !succeeded.includes(op.id));
        
        // Update failed operations attempts
        for (const operation of failed) {
            operation.attempts++;
            if (operation.attempts >= OfflineConfig.sync.retryAttempts) {
                // Remove after max attempts
                this.queue = this.queue.filter(op => op.id !== operation.id);
                this.notifyFailure(operation);
            }
        }
        
        this.saveQueue();
        this.lastSync = new Date();
        this.saveLastSync();
        
        this.isSyncing = false;
        
        // Notify sync complete
        this.notifySyncComplete(succeeded.length, failed.length);
        
        // Process next batch if any
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), 1000);
        }
    }
    
    async executeOperation(operation) {
        try {
            const response = await fetch(operation.url, {
                method: operation.method,
                headers: {
                    'Content-Type': 'application/json',
                    ...operation.headers
                },
                body: operation.body ? JSON.stringify(operation.body) : undefined
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Update cache with result
            if (operation.cacheKey) {
                this.cache.set(operation.cacheKey, result);
            }
            
            return true;
        } catch (error) {
            console.error(`[Sync] Failed operation ${operation.id}:`, error);
            return false;
        }
    }
    
    generateId() {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    startAutoSync() {
        setInterval(() => {
            if (navigator.onLine && this.queue.length > 0) {
                this.processQueue();
            }
        }, OfflineConfig.sync.interval);
    }
    
    setupOnlineListener() {
        window.addEventListener('online', () => {
            console.log('[Sync] Online detected, syncing...');
            this.processQueue();
            this.notifyOnline();
        });
        
        window.addEventListener('offline', () => {
            console.log('[Sync] Offline detected');
            this.notifyOffline();
        });
    }
    
    onSync(callback) {
        this.syncCallbacks.push(callback);
    }
    
    notifySyncComplete(succeeded, failed) {
        this.syncCallbacks.forEach(cb => 
            cb({ type: 'complete', succeeded, failed, timestamp: new Date() })
        );
        
        const event = new CustomEvent('offline:syncComplete', {
            detail: { succeeded, failed }
        });
        document.dispatchEvent(event);
    }
    
    notifyFailure(operation) {
        const event = new CustomEvent('offline:syncFailed', {
            detail: { operation }
        });
        document.dispatchEvent(event);
    }
    
    notifyOnline() {
        const event = new CustomEvent('offline:online', {
            detail: { timestamp: new Date() }
        });
        document.dispatchEvent(event);
    }
    
    notifyOffline() {
        const event = new CustomEvent('offline:offline', {
            detail: { timestamp: new Date() }
        });
        document.dispatchEvent(event);
    }
    
    getQueue() {
        return [...this.queue];
    }
    
    getQueueSize() {
        return this.queue.length;
    }
    
    getLastSync() {
        return this.lastSync;
    }
    
    clearQueue() {
        this.queue = [];
        this.saveQueue();
    }
}

// ============================================
// DATA MANAGER
// ============================================

class OfflineDataManager {
    constructor(cacheManager, syncManager) {
        this.cache = cacheManager;
        this.sync = syncManager;
        this.data = {};
        this.init();
    }
    
    init() {
        this.loadData();
        this.setupDataSync();
    }
    
    loadData() {
        // Load vocabulary
        const vocabulary = this.cache.get(OfflineConfig.dataTypes.vocabulary);
        if (vocabulary) this.data.vocabulary = vocabulary;
        
        // Load progress
        const progress = this.cache.get(OfflineConfig.dataTypes.progress);
        if (progress) this.data.progress = progress;
        
        // Load settings
        const settings = this.cache.get(OfflineConfig.dataTypes.settings);
        if (settings) this.data.settings = settings;
        
        // Load lessons
        const lessons = this.cache.get(OfflineConfig.dataTypes.lessons);
        if (lessons) this.data.lessons = lessons;
        
        // Load achievements
        const achievements = this.cache.get(OfflineConfig.dataTypes.achievements);
        if (achievements) this.data.achievements = achievements;
    }
    
    setupDataSync() {
        this.sync.onSync((result) => {
            if (result.type === 'complete') {
                this.refreshData();
            }
        });
    }
    
    async savePractice(practiceData) {
        // Save to cache
        const practices = this.cache.get('practices') || [];
        practices.unshift({
            ...practiceData,
            id: this.generateId(),
            timestamp: Date.now(),
            synced: false
        });
        
        // Keep only last 100 practices
        if (practices.length > 100) practices.pop();
        
        this.cache.set('practices', practices);
        
        // Add to sync queue
        this.sync.addToQueue({
            url: '/api/practices',
            method: 'POST',
            body: practiceData,
            cacheKey: 'practices'
        });
        
        return practiceData;
    }
    
    async saveProgress(progressData) {
        this.cache.set(OfflineConfig.dataTypes.progress, {
            ...this.data.progress,
            ...progressData,
            lastUpdated: Date.now()
        });
        
        this.sync.addToQueue({
            url: '/api/progress',
            method: 'PUT',
            body: progressData,
            cacheKey: OfflineConfig.dataTypes.progress
        });
        
        this.data.progress = this.cache.get(OfflineConfig.dataTypes.progress);
        return this.data.progress;
    }
    
    async downloadLessons(lessonIds) {
        if (navigator.onLine) {
            try {
                const response = await fetch('/api/lessons/batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lessonIds })
                });
                
                const lessons = await response.json();
                this.cache.set(OfflineConfig.dataTypes.lessons, lessons);
                this.data.lessons = lessons;
                
                return lessons;
            } catch (error) {
                console.error('Failed to download lessons:', error);
                return null;
            }
        } else {
            return this.data.lessons;
        }
    }
    
    getVocabulary() {
        return this.data.vocabulary || [];
    }
    
    getProgress() {
        return this.data.progress || {};
    }
    
    getSettings() {
        return this.data.settings || {};
    }
    
    getLessons() {
        return this.data.lessons || [];
    }
    
    getAchievements() {
        return this.data.achievements || [];
    }
    
    refreshData() {
        // Refresh from cache
        this.data.vocabulary = this.cache.get(OfflineConfig.dataTypes.vocabulary);
        this.data.progress = this.cache.get(OfflineConfig.dataTypes.progress);
        this.data.settings = this.cache.get(OfflineConfig.dataTypes.settings);
        this.data.lessons = this.cache.get(OfflineConfig.dataTypes.lessons);
        this.data.achievements = this.cache.get(OfflineConfig.dataTypes.achievements);
        
        const event = new CustomEvent('offline:dataRefreshed', {
            detail: { data: this.data }
        });
        document.dispatchEvent(event);
    }
    
    generateId() {
        return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getStorageInfo() {
        const cacheStats = this.cache.getStats();
        
        return {
            cache: cacheStats,
            queueSize: this.sync.getQueueSize(),
            lastSync: this.sync.getLastSync(),
            isOnline: navigator.onLine,
            dataTypes: Object.keys(this.data).map(key => ({
                type: key,
                size: JSON.stringify(this.data[key]).length
            }))
        };
    }
}

// ============================================
// OFFLINE UI CONTROLLER
// ============================================

class OfflineUIController {
    constructor(dataManager, syncManager, cacheManager) {
        this.dataManager = dataManager;
        this.syncManager = syncManager;
        this.cacheManager = cacheManager;
        this.elements = {};
        this.init();
    }
    
    init() {
        this.bindElements();
        this.bindEvents();
        this.updateUI();
        this.startStatusCheck();
    }
    
    bindElements() {
        this.elements = {
            offlineIndicator: document.getElementById('offlineIndicator'),
            syncStatus: document.getElementById('syncStatus'),
            offlineProgress: document.getElementById('offlineProgress'),
            downloadedLessons: document.getElementById('downloadedLessons'),
            syncButton: document.getElementById('manualSyncBtn'),
            clearCacheBtn: document.getElementById('clearCacheBtn'),
            downloadLessonsBtn: document.getElementById('downloadLessonsBtn')
        };
    }
    
    bindEvents() {
        if (this.elements.syncButton) {
            this.elements.syncButton.addEventListener('click', () => this.manualSync());
        }
        
        if (this.elements.clearCacheBtn) {
            this.elements.clearCacheBtn.addEventListener('click', () => this.clearCache());
        }
        
        if (this.elements.downloadLessonsBtn) {
            this.elements.downloadLessonsBtn.addEventListener('click', () => this.downloadLessons());
        }
        
        document.addEventListener('offline:syncComplete', (e) => {
            this.updateSyncStatus(`Synced ${e.detail.succeeded} items`);
            this.updateUI();
        });
        
        document.addEventListener('offline:online', () => {
            this.updateSyncStatus('Online - Auto syncing');
            this.updateUI();
        });
        
        document.addEventListener('offline:offline', () => {
            this.updateSyncStatus('Offline mode - Data saved locally');
            this.updateUI();
        });
        
        document.addEventListener('offline:dataRefreshed', () => {
            this.updateUI();
        });
        
        window.addEventListener('online', () => this.updateUI());
        window.addEventListener('offline', () => this.updateUI());
    }
    
    updateUI() {
        const isOnline = navigator.onLine;
        const queueSize = this.syncManager.getQueueSize();
        const cacheStats = this.cacheManager.getStats();
        
        // Update offline indicator
        if (this.elements.offlineIndicator) {
            if (!isOnline) {
                this.elements.offlineIndicator.classList.add('show');
            } else {
                this.elements.offlineIndicator.classList.remove('show');
            }
        }
        
        // Update sync status
        if (this.elements.syncStatus) {
            if (isOnline) {
                if (queueSize > 0) {
                    this.elements.syncStatus.innerHTML = `🔄 Syncing (${queueSize} items pending)`;
                } else {
                    this.elements.syncStatus.innerHTML = '✅ Online - Auto syncing';
                }
            } else {
                this.elements.syncStatus.innerHTML = '📡 Offline mode - Data saved locally';
            }
        }
        
        // Update offline progress
        if (this.elements.offlineProgress) {
            const practices = this.cacheManager.get('practices') || [];
            this.elements.offlineProgress.innerHTML = `${practices.filter(p => !p.synced).length} practice sessions cached`;
        }
        
        // Update downloaded lessons
        if (this.elements.downloadedLessons) {
            const lessons = this.dataManager.getLessons();
            this.elements.downloadedLessons.innerHTML = `${lessons.length} / 10 lessons`;
        }
        
        // Update sync button state
        if (this.elements.syncButton) {
            this.elements.syncButton.disabled = !isOnline || queueSize === 0;
        }
    }
    
    updateSyncStatus(message) {
        if (this.elements.syncStatus) {
            this.elements.syncStatus.innerHTML = message;
            setTimeout(() => {
                if (this.elements.syncStatus.innerHTML === message) {
                    this.updateUI();
                }
            }, 3000);
        }
    }
    
    async manualSync() {
        if (!navigator.onLine) {
            this.showToast('Cannot sync while offline', 'warning');
            return;
        }
        
        this.updateSyncStatus('Syncing...');
        await this.syncManager.processQueue();
    }
    
    async clearCache() {
        if (confirm('Clear all offline data? You will need to redownload lessons.')) {
            this.cacheManager.clear();
            this.syncManager.clearQueue();
            this.dataManager.refreshData();
            this.showToast('Cache cleared successfully', 'success');
            this.updateUI();
        }
    }
    
    async downloadLessons() {
        if (!navigator.onLine) {
            this.showToast('Cannot download while offline', 'warning');
            return;
        }
        
        const lessonIds = ['lesson1', 'lesson2', 'lesson3', 'lesson4', 'lesson5'];
        
        this.showToast('Downloading lessons...', 'info');
        
        const lessons = await this.dataManager.downloadLessons(lessonIds);
        
        if (lessons) {
            this.showToast(`Downloaded ${lessons.length} lessons for offline use`, 'success');
            this.updateUI();
        } else {
            this.showToast('Failed to download lessons', 'error');
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `offline-toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
    
    startStatusCheck() {
        setInterval(() => {
            this.updateUI();
        }, 5000);
    }
    
    getStatus() {
        return {
            isOnline: navigator.onLine,
            queueSize: this.syncManager.getQueueSize(),
            cacheStats: this.cacheManager.getStats(),
            lastSync: this.syncManager.getLastSync()
        };
    }
}

// ============================================
// EXPORTS
// ============================================

// Initialize offline system
const cacheManager = new CacheManager();
const syncManager = new SyncManager(cacheManager);
const offlineDataManager = new OfflineDataManager(cacheManager, syncManager);
const offlineUI = new OfflineUIController(offlineDataManager, syncManager, cacheManager);

// Global exports
window.SpeakFlow = window.SpeakFlow || {};
window.SpeakFlow.Offline = {
    cache: cacheManager,
    sync: syncManager,
    data: offlineDataManager,
    ui: offlineUI,
    config: OfflineConfig
};

// Module exports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OfflineConfig,
        CacheManager,
        SyncManager,
        OfflineDataManager,
        OfflineUIController
    };
}

// ============================================
// CSS STYLES
// ============================================

const style = document.createElement('style');
style.textContent = `
    .offline-indicator {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: var(--color-warning);
        color: white;
        text-align: center;
        padding: 8px;
        font-size: 14px;
        z-index: 10000;
        transform: translateY(-100%);
        transition: transform 0.3s ease;
    }
    
    .offline-indicator.show {
        transform: translateY(0);
    }
    
    .offline-toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 40px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideUp 0.3s ease;
    }
    
    .toast-success {
        background: #10b981;
    }
    
    .toast-error {
        background: #ef4444;
    }
    
    .toast-warning {
        background: #f59e0b;
    }
    
    .toast-info {
        background: #3b82f6;
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
    
    .sync-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        padding: 4px 12px;
        border-radius: 20px;
        background: var(--bg-secondary);
    }
    
    .sync-status.online {
        color: #10b981;
    }
    
    .sync-status.offline {
        color: #f59e0b;
    }
    
    .sync-status.syncing {
        color: #3b82f6;
        animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;

document.head.appendChild(style);

// ============================================
// AUTO-INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Offline module initialized');
    
    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered for offline support');
        }).catch(error => {
            console.error('Service Worker registration failed:', error);
        });
    }
    
    // Debug mode
    if (window.location.hostname === 'localhost') {
        window.debugOffline = {
            cache: cacheManager,
            sync: syncManager,
            data: offlineDataManager
        };
        console.log('Offline debug mode enabled');
    }
});
