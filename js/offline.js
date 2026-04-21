// ============================================
// SpeakFlow Offline Module
// Offline Mode & Sync Management
// ============================================

// ============================================
// Offline State Management
// ============================================

const OfflineState = {
    isOnline: navigator.onLine,
    isSupported: false,
    isSyncing: false,
    pendingActions: [],
    cachedData: new Map(),
    syncQueue: [],
    lastSyncTime: null,
    storageUsed: 0,
    storageQuota: 0,
    db: null,
    initialized: false
};

// ============================================
// Configuration
// ============================================

const OFFLINE_CONFIG = {
    DB_NAME: 'speakflow_offline',
    DB_VERSION: 1,
    STORES: {
        LESSONS: 'lessons',
        VOCABULARY: 'vocabulary',
        PROGRESS: 'progress',
        ACTIONS: 'pending_actions',
        CACHE: 'cache'
    },
    MAX_CACHE_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
    SYNC_INTERVAL: 30000, // 30 seconds
    MAX_STORAGE_MB: 50,
    AUTO_SYNC: true
};

// ============================================
// IndexedDB Initialization
// ============================================

/**
 * Initialize IndexedDB
 */
const initDB = () => {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.warn('IndexedDB not supported');
            OfflineState.isSupported = false;
            reject(new Error('IndexedDB not supported'));
            return;
        }
        
        const request = indexedDB.open(OFFLINE_CONFIG.DB_NAME, OFFLINE_CONFIG.DB_VERSION);
        
        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            OfflineState.db = request.result;
            OfflineState.isSupported = true;
            resolve(OfflineState.db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains(OFFLINE_CONFIG.STORES.LESSONS)) {
                const lessonStore = db.createObjectStore(OFFLINE_CONFIG.STORES.LESSONS, { keyPath: 'id' });
                lessonStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(OFFLINE_CONFIG.STORES.VOCABULARY)) {
                const vocabStore = db.createObjectStore(OFFLINE_CONFIG.STORES.VOCABULARY, { keyPath: 'id' });
                vocabStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(OFFLINE_CONFIG.STORES.PROGRESS)) {
                db.createObjectStore(OFFLINE_CONFIG.STORES.PROGRESS, { keyPath: 'id' });
            }
            
            if (!db.objectStoreNames.contains(OFFLINE_CONFIG.STORES.ACTIONS)) {
                const actionStore = db.createObjectStore(OFFLINE_CONFIG.STORES.ACTIONS, { keyPath: 'id', autoIncrement: true });
                actionStore.createIndex('timestamp', 'timestamp', { unique: false });
                actionStore.createIndex('synced', 'synced', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(OFFLINE_CONFIG.STORES.CACHE)) {
                const cacheStore = db.createObjectStore(OFFLINE_CONFIG.STORES.CACHE, { keyPath: 'key' });
                cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
                cacheStore.createIndex('expiry', 'expiry', { unique: false });
            }
        };
    });
};

// ============================================
// Storage Management
// ============================================

/**
 * Check storage quota
 */
const checkStorageQuota = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        OfflineState.storageUsed = estimate.usage || 0;
        OfflineState.storageQuota = estimate.quota || 0;
        
        return {
            used: OfflineState.storageUsed,
            quota: OfflineState.storageQuota,
            percentage: (OfflineState.storageUsed / OfflineState.storageQuota) * 100
        };
    }
    return null;
};

/**
 * Clear old cache data
 */
const clearOldCache = async () => {
    const store = OFFLINE_CONFIG.STORES.CACHE;
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([store], 'readwrite');
        const objectStore = transaction.objectStore(store);
        const index = objectStore.index('expiry');
        const range = IDBKeyRange.upperBound(now);
        
        const request = index.openCursor(range);
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            } else {
                resolve();
            }
        };
        
        request.onerror = () => reject(request.error);
    });
};

// ============================================
// Data Caching
// ============================================

/**
 * Cache data to IndexedDB
 */
const cacheData = async (storeName, key, data, ttl = OFFLINE_CONFIG.MAX_CACHE_AGE) => {
    if (!OfflineState.db) return false;
    
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([storeName], 'readwrite');
        const objectStore = transaction.objectStore(storeName);
        
        const cacheItem = {
            id: key,
            data: data,
            timestamp: Date.now(),
            expiry: Date.now() + ttl
        };
        
        const request = objectStore.put(cacheItem);
        
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get cached data
 */
const getCachedData = async (storeName, key) => {
    if (!OfflineState.db) return null;
    
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const request = objectStore.get(key);
        
        request.onsuccess = () => {
            const result = request.result;
            if (result && result.expiry > Date.now()) {
                resolve(result.data);
            } else {
                resolve(null);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
};

/**
 * Clear all cached data
 */
const clearCache = async () => {
    const stores = Object.values(OFFLINE_CONFIG.STORES);
    
    for (const store of stores) {
        await new Promise((resolve, reject) => {
            const transaction = OfflineState.db.transaction([store], 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// ============================================
// Offline Actions Queue
// ============================================

/**
 * Queue action for later sync
 */
const queueAction = async (action) => {
    const actionItem = {
        ...action,
        timestamp: Date.now(),
        synced: false,
        retryCount: 0
    };
    
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([OFFLINE_CONFIG.STORES.ACTIONS], 'readwrite');
        const objectStore = transaction.objectStore(OFFLINE_CONFIG.STORES.ACTIONS);
        const request = objectStore.add(actionItem);
        
        request.onsuccess = () => {
            OfflineState.pendingActions.push(actionItem);
            resolve(actionItem);
        };
        
        request.onerror = () => reject(request.error);
    });
};

/**
 * Get pending actions
 */
const getPendingActions = async () => {
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([OFFLINE_CONFIG.STORES.ACTIONS], 'readonly');
        const objectStore = transaction.objectStore(OFFLINE_CONFIG.STORES.ACTIONS);
        const index = objectStore.index('synced');
        const range = IDBKeyRange.only(false);
        const request = index.getAll(range);
        
        request.onsuccess = () => {
            OfflineState.pendingActions = request.result;
            resolve(request.result);
        };
        
        request.onerror = () => reject(request.error);
    });
};

/**
 * Mark action as synced
 */
const markActionSynced = async (actionId) => {
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([OFFLINE_CONFIG.STORES.ACTIONS], 'readwrite');
        const objectStore = transaction.objectStore(OFFLINE_CONFIG.STORES.ACTIONS);
        const request = objectStore.get(actionId);
        
        request.onsuccess = () => {
            const action = request.result;
            if (action) {
                action.synced = true;
                action.syncedAt = Date.now();
                objectStore.put(action);
            }
            resolve();
        };
        
        request.onerror = () => reject(request.error);
    });
};

/**
 * Remove action from queue
 */
const removeAction = async (actionId) => {
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([OFFLINE_CONFIG.STORES.ACTIONS], 'readwrite');
        const objectStore = transaction.objectStore(OFFLINE_CONFIG.STORES.ACTIONS);
        const request = objectStore.delete(actionId);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// ============================================
// Sync Manager
// ============================================

/**
 * Sync pending actions with server
 */
const syncPendingActions = async () => {
    if (!OfflineState.isOnline || OfflineState.isSyncing) return;
    
    OfflineState.isSyncing = true;
    updateSyncStatus('syncing');
    
    const actions = await getPendingActions();
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const action of actions) {
        try {
            const response = await fetch(action.url, {
                method: action.method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth?.token || ''}`
                },
                body: JSON.stringify(action.data)
            });
            
            if (response.ok) {
                await markActionSynced(action.id);
                syncedCount++;
            } else {
                failedCount++;
                action.retryCount++;
                if (action.retryCount >= 3) {
                    await markActionSynced(action.id); // Mark as failed permanently
                } else {
                    await queueAction(action); // Re-queue for retry
                }
                await removeAction(action.id);
            }
        } catch (error) {
            console.error('Sync action failed:', error);
            failedCount++;
        }
    }
    
    OfflineState.lastSyncTime = Date.now();
    OfflineState.isSyncing = false;
    
    if (syncedCount > 0 || failedCount > 0) {
        updateSyncStatus('completed', { synced: syncedCount, failed: failedCount });
    } else {
        updateSyncStatus('idle');
    }
};

/**
 * Start periodic sync
 */
const startPeriodicSync = () => {
    if (!OFFLINE_CONFIG.AUTO_SYNC) return;
    
    setInterval(() => {
        if (OfflineState.isOnline) {
            syncPendingActions();
        }
    }, OFFLINE_CONFIG.SYNC_INTERVAL);
};

// ============================================
// Offline Data Storage
// ============================================

/**
 * Save lesson for offline access
 */
const saveLessonOffline = async (lesson) => {
    await cacheData(OFFLINE_CONFIG.STORES.LESSONS, lesson.id, lesson);
    showToast(`Lesson "${lesson.title}" saved for offline use`, 'success');
};

/**
 * Get offline lessons
 */
const getOfflineLessons = async () => {
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([OFFLINE_CONFIG.STORES.LESSONS], 'readonly');
        const objectStore = transaction.objectStore(OFFLINE_CONFIG.STORES.LESSONS);
        const request = objectStore.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Save vocabulary for offline access
 */
const saveVocabularyOffline = async (word) => {
    await cacheData(OFFLINE_CONFIG.STORES.VOCABULARY, word.id, word);
};

/**
 * Get offline vocabulary
 */
const getOfflineVocabulary = async () => {
    return new Promise((resolve, reject) => {
        const transaction = OfflineState.db.transaction([OFFLINE_CONFIG.STORES.VOCABULARY], 'readonly');
        const objectStore = transaction.objectStore(OFFLINE_CONFIG.STORES.VOCABULARY);
        const request = objectStore.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Save progress offline
 */
const saveProgressOffline = async (progress) => {
    await cacheData(OFFLINE_CONFIG.STORES.PROGRESS, `progress_${progress.userId}`, progress);
};

/**
 * Get offline progress
 */
const getOfflineProgress = async (userId) => {
    return await getCachedData(OFFLINE_CONFIG.STORES.PROGRESS, `progress_${userId}`);
};

// ============================================
// Network Status Monitoring
// ============================================

/**
 * Update online status
 */
const updateOnlineStatus = () => {
    const wasOnline = OfflineState.isOnline;
    OfflineState.isOnline = navigator.onLine;
    
    if (wasOnline !== OfflineState.isOnline) {
        if (OfflineState.isOnline) {
            handleOnline();
        } else {
            handleOffline();
        }
    }
    
    updateNetworkUI();
};

/**
 * Handle going online
 */
const handleOnline = () => {
    showToast('You are back online! Syncing data...', 'success');
    syncPendingActions();
    
    // Refresh data
    if (window.location.pathname.includes('/dashboard')) {
        location.reload();
    }
};

/**
 * Handle going offline
 */
const handleOffline = () => {
    showToast('You are offline. Some features may be limited.', 'warning');
    
    // Load cached data
    loadCachedData();
};

/**
 * Update network status UI
 */
const updateNetworkUI = () => {
    const statusBar = document.getElementById('network-status');
    if (statusBar) {
        if (OfflineState.isOnline) {
            statusBar.className = 'network-status online';
            statusBar.innerHTML = '🟢 Online';
        } else {
            statusBar.className = 'network-status offline';
            statusBar.innerHTML = '🔴 Offline Mode';
        }
    }
    
    // Update offline indicator
    const offlineIndicator = document.getElementById('offline-indicator');
    if (offlineIndicator) {
        offlineIndicator.style.display = OfflineState.isOnline ? 'none' : 'flex';
    }
};

/**
 * Update sync status UI
 */
const updateSyncStatus = (status, stats = {}) => {
    const syncIndicator = document.getElementById('sync-status');
    if (!syncIndicator) return;
    
    switch (status) {
        case 'syncing':
            syncIndicator.className = 'sync-status syncing';
            syncIndicator.innerHTML = '🔄 Syncing...';
            break;
        case 'completed':
            if (stats.synced > 0 || stats.failed > 0) {
                syncIndicator.className = 'sync-status completed';
                syncIndicator.innerHTML = `✅ Synced: ${stats.synced} | Failed: ${stats.failed}`;
                setTimeout(() => {
                    syncIndicator.className = 'sync-status idle';
                    syncIndicator.innerHTML = '☁️ All synced';
                }, 3000);
            }
            break;
        default:
            syncIndicator.className = 'sync-status idle';
            syncIndicator.innerHTML = '☁️ All synced';
    }
};

/**
 * Load cached data when offline
 */
const loadCachedData = async () => {
    // Load lessons
    const lessons = await getOfflineLessons();
    if (lessons.length > 0 && window.location.pathname.includes('/practice')) {
        displayOfflineLessons(lessons);
    }
    
    // Load vocabulary
    const vocabulary = await getOfflineVocabulary();
    if (vocabulary.length > 0 && window.location.pathname.includes('/vocabulary')) {
        displayOfflineVocabulary(vocabulary);
    }
};

/**
 * Display offline lessons
 */
const displayOfflineLessons = (lessons) => {
    const container = document.getElementById('lessons-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="offline-banner">
            <span>📡 Offline Mode</span>
            <p>Showing cached lessons. Connect to internet for more content.</p>
        </div>
        <div class="lessons-grid">
            ${lessons.map(lesson => `
                <div class="lesson-card" onclick="offline.startOfflineLesson('${lesson.id}')">
                    <h3>${lesson.title}</h3>
                    <p>${lesson.description}</p>
                    <span class="offline-badge">Available Offline</span>
                </div>
            `).join('')}
        </div>
    `;
};

/**
 * Display offline vocabulary
 */
const displayOfflineVocabulary = (vocabulary) => {
    const container = document.getElementById('vocabulary-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="offline-banner">
            <span>📡 Offline Mode</span>
            <p>Showing cached vocabulary. Connect to internet for more words.</p>
        </div>
        <div class="vocabulary-grid">
            ${vocabulary.map(word => `
                <div class="vocab-card">
                    <h4>${word.word}</h4>
                    <p>${word.translation}</p>
                </div>
            `).join('')}
        </div>
    `;
};

// ============================================
// Offline Lesson Player
// ============================================

/**
 * Start offline lesson
 */
const startOfflineLesson = async (lessonId) => {
    const lesson = await getCachedData(OFFLINE_CONFIG.STORES.LESSONS, lessonId);
    if (!lesson) {
        showToast('Lesson not available offline', 'error');
        return;
    }
    
    // Store current lesson in session storage
    sessionStorage.setItem('offline_lesson', JSON.stringify(lesson));
    window.location.href = '/offline-lesson.html';
};

/**
 * Record offline progress
 */
const recordOfflineProgress = async (lessonId, score, progress) => {
    const userId = auth?.user?.id || 'anonymous';
    
    await queueAction({
        url: '/api/sessions/submit',
        method: 'POST',
        data: {
            userId,
            lessonId,
            score,
            progress,
            timestamp: Date.now(),
            wasOffline: true
        }
    });
    
    // Save progress locally
    const offlineProgress = await getOfflineProgress(userId) || {};
    offlineProgress[lessonId] = {
        score,
        progress,
        completedAt: Date.now()
    };
    await saveProgressOffline({ userId, data: offlineProgress });
};

// ============================================
// UI Components
// ============================================

/**
 * Create offline indicator
 */
const createOfflineIndicator = () => {
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.className = 'offline-indicator';
    indicator.style.display = 'none';
    indicator.innerHTML = `
        <div class="offline-content">
            <span class="offline-icon">📡</span>
            <span>Offline Mode</span>
            <button class="offline-dismiss">&times;</button>
        </div>
    `;
    
    document.body.appendChild(indicator);
    
    const dismissBtn = indicator.querySelector('.offline-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            indicator.style.display = 'none';
        });
    }
};

/**
 * Create sync status indicator
 */
const createSyncIndicator = () => {
    const indicator = document.createElement('div');
    indicator.id = 'sync-status';
    indicator.className = 'sync-status idle';
    indicator.innerHTML = '☁️ All synced';
    document.body.appendChild(indicator);
};

/**
 * Create storage info modal
 */
const showStorageInfo = async () => {
    const storage = await checkStorageQuota();
    if (!storage) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Storage Info</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="storage-info">
                    <div class="storage-bar">
                        <div class="storage-used" style="width: ${storage.percentage}%"></div>
                    </div>
                    <p>Used: ${formatBytes(storage.used)} / ${formatBytes(storage.quota)}</p>
                    <p>Pending actions: ${OfflineState.pendingActions.length}</p>
                    <p>Last sync: ${OfflineState.lastSyncTime ? new Date(OfflineState.lastSyncTime).toLocaleString() : 'Never'}</p>
                </div>
                <div class="modal-buttons">
                    <button class="btn btn-danger" onclick="offline.clearAllData()">Clear All Offline Data</button>
                    <button class="btn btn-primary" onclick="offline.syncNow()">Sync Now</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
};

/**
 * Format bytes
 */
const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Clear all offline data
 */
const clearAllData = async () => {
    if (confirm('Are you sure? This will delete all offline data including saved lessons and pending actions.')) {
        await clearCache();
        showToast('Offline data cleared', 'info');
        if (window.location.pathname.includes('/practice')) {
            location.reload();
        }
    }
};

/**
 * Force sync now
 */
const syncNow = async () => {
    if (!OfflineState.isOnline) {
        showToast('Cannot sync while offline', 'warning');
        return;
    }
    
    await syncPendingActions();
    showToast('Sync completed', 'success');
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize offline module
 */
const initOffline = async () => {
    console.log('Initializing offline module...');
    
    // Initialize IndexedDB
    try {
        await initDB();
        await clearOldCache();
        await getPendingActions();
    } catch (error) {
        console.error('Failed to initialize offline storage:', error);
    }
    
    // Setup network listeners
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial status
    updateOnlineStatus();
    
    // Create UI components
    createOfflineIndicator();
    createSyncIndicator();
    
    // Start periodic sync
    startPeriodicSync();
    
    // Check storage quota periodically
    setInterval(async () => {
        if (OfflineState.isOnline) {
            await checkStorageQuota();
        }
    }, 60000);
    
    OfflineState.initialized = true;
    
    console.log('Offline module initialized');
};

// ============================================
// Export Offline Module
// ============================================

const offline = {
    // State
    get isOnline() { return OfflineState.isOnline; },
    get isSupported() { return OfflineState.isSupported; },
    get pendingActions() { return OfflineState.pendingActions; },
    
    // Storage
    cacheData,
    getCachedData,
    clearCache,
    clearAllData,
    checkStorageQuota,
    showStorageInfo,
    
    // Offline data
    saveLessonOffline,
    getOfflineLessons,
    saveVocabularyOffline,
    getOfflineVocabulary,
    saveProgressOffline,
    getOfflineProgress,
    
    // Sync
    queueAction,
    syncPendingActions,
    syncNow,
    
    // Offline lesson
    startOfflineLesson,
    recordOfflineProgress,
    
    // Initialize
    init: initOffline
};

// Make offline globally available
window.offline = offline;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOffline);
} else {
    initOffline();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = offline;
}
