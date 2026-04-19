// sw.js - SpeakFlow Service Worker
// Version: 1.0.0
// Cache nama dan versi

const CACHE_NAME = 'speakflow-v1.0.0';
const OFFLINE_CACHE = 'speakflow-offline-v1';
const DYNAMIC_CACHE = 'speakflow-dynamic-v1';
const API_CACHE = 'speakflow-api-v1';

// Assets yang perlu di-cache saat install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/main.css',
    '/css/dashboard.css',
    '/js/app.js',
    '/js/voice.js',
    '/js/auth.js',
    '/js/offline.js',
    '/images/logo.svg',
    '/images/icons/icon-72x72.png',
    '/images/icons/icon-96x96.png',
    '/images/icons/icon-128x128.png',
    '/images/icons/icon-144x144.png',
    '/images/icons/icon-152x152.png',
    '/images/icons/icon-192x192.png',
    '/images/icons/icon-384x384.png',
    '/images/icons/icon-512x512.png',
    '/audio/correct.mp3',
    '/audio/incorrect.mp3',
    '/audio/level-up.mp3',
    '/audio/notification.mp3'
];

// API endpoints yang perlu di-cache (GET requests)
const API_ENDPOINTS = [
    '/api/user/profile',
    '/api/user/progress',
    '/api/challenges/daily',
    '/api/vocabulary/words',
    '/api/analytics/stats'
];

// ========== INSTALL EVENT ==========
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        (async () => {
            // Open cache dan tambahkan static assets
            const cache = await caches.open(CACHE_NAME);
            console.log('[SW] Caching static assets');
            
            try {
                await cache.addAll(STATIC_ASSETS);
                console.log('[SW] Static assets cached successfully');
            } catch (error) {
                console.error('[SW] Failed to cache assets:', error);
            }
            
            // Skip waiting to activate immediately
            await self.skipWaiting();
        })()
    );
});

// ========== ACTIVATE EVENT ==========
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    
    event.waitUntil(
        (async () => {
            // Hapus cache lama yang tidak digunakan
            const cacheNames = await caches.keys();
            const oldCaches = cacheNames.filter(name => 
                name !== CACHE_NAME && 
                name !== OFFLINE_CACHE && 
                name !== DYNAMIC_CACHE && 
                name !== API_CACHE
            );
            
            await Promise.all(
                oldCaches.map(name => {
                    console.log(`[SW] Deleting old cache: ${name}`);
                    return caches.delete(name);
                })
            );
            
            // Claim clients to take control immediately
            await self.clients.claim();
            console.log('[SW] Service Worker activated and controlling clients');
        })()
    );
});

// ========== FETCH EVENT ==========
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // API requests handling
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleAPIRequest(request));
        return;
    }
    
    // Static assets (CSS, JS, images)
    if (STATIC_ASSETS.some(asset => url.pathname.includes(asset))) {
        event.respondWith(handleStaticRequest(request));
        return;
    }
    
    // HTML pages (offline fallback)
    if (request.headers.get('accept').includes('text/html')) {
        event.respondWith(handleHTMLRequest(request));
        return;
    }
    
    // Other requests (images, fonts, etc.)
    event.respondWith(handleOtherRequest(request));
});

// ========== REQUEST HANDLERS ==========

/**
 * Handle API requests - Network first with cache fallback
 */
async function handleAPIRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache for API:', request.url);
        
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline API response
        return new Response(
            JSON.stringify({
                offline: true,
                message: 'You are offline. Some features may be limited.',
                timestamp: new Date().toISOString()
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Handle static assets - Cache first with network fallback
 */
async function handleStaticRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Fallback to network
        const networkResponse = await fetch(request);
        
        // Cache the new response
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] Failed to load static asset:', request.url);
        
        // Return default icon for images
        if (request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
            return caches.match('/images/icons/icon-192x192.png');
        }
        
        return new Response('Resource not available offline', { status: 404 });
    }
}

/**
 * Handle HTML requests - Network first with offline fallback
 */
async function handleHTMLRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache the HTML for offline use
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(OFFLINE_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Offline mode - serving cached HTML');
        
        // Try to get from cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page
        return getOfflinePage();
    }
}

/**
 * Handle other requests (images, fonts) - Cache first
 */
async function handleOtherRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Try network
        const networkResponse = await fetch(request);
        
        // Cache for future
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[SW] Failed to load resource:', request.url);
        
        // Return placeholder for images
        if (request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
            return caches.match('/images/icons/icon-192x192.png');
        }
        
        return new Response('', { status: 404 });
    }
}

/**
 * Generate offline page HTML
 */
async function getOfflinePage() {
    const offlineHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SpeakFlow - Offline Mode</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #1e293b, #0f172a);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            text-align: center;
            padding: 20px;
        }
        .offline-container {
            max-width: 400px;
        }
        .offline-icon {
            font-size: 5rem;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 1.8rem;
            margin-bottom: 16px;
        }
        p {
            color: #94a3b8;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        .retry-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 32px;
            border-radius: 40px;
            font-size: 1rem;
            cursor: pointer;
            margin-top: 20px;
        }
        .saved-content {
            margin-top: 32px;
            padding: 20px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
        }
        .feature {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 12px 0;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1>You're Offline</h1>
        <p>Don't worry! You can still practice with downloaded lessons and review your vocabulary.</p>
        <button class="retry-btn" onclick="location.reload()">Try Again</button>
        
        <div class="saved-content">
            <h3 style="margin-bottom: 16px;">✅ Available Offline</h3>
            <div class="feature">📚 Downloaded vocabulary lessons</div>
            <div class="feature">📊 Your saved progress</div>
            <div class="feature">🏆 Achievements & badges</div>
            <div class="feature">📝 Practice history</div>
        </div>
        
        <p style="margin-top: 32px; font-size: 0.8rem;">
            Progress will sync automatically when you're back online.
        </p>
    </div>
    
    <script>
        // Check online status periodically
        setInterval(() => {
            if (navigator.onLine) {
                location.reload();
            }
        }, 30000);
    </script>
</body>
</html>
    `;
    
    return new Response(offlineHTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
    });
}

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-practices') {
        event.waitUntil(syncOfflinePractices());
    } else if (event.tag === 'sync-progress') {
        event.waitUntil(syncUserProgress());
    }
});

/**
 * Sync offline practice sessions to server
 */
async function syncOfflinePractices() {
    console.log('[SW] Syncing offline practices...');
    
    try {
        const cache = await caches.open('offline-practices');
        const requests = await cache.keys();
        
        const syncResults = await Promise.allSettled(
            requests.map(async (request) => {
                const response = await cache.match(request);
                const practiceData = await response.json();
                
                // Send to server
                const syncResponse = await fetch('/api/sessions/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(practiceData)
                });
                
                if (syncResponse.ok) {
                    // Delete from cache after successful sync
                    await cache.delete(request);
                    return { success: true, id: practiceData.id };
                }
                
                return { success: false, id: practiceData.id };
            })
        );
        
        const synced = syncResults.filter(r => r.value?.success).length;
        console.log(`[SW] Synced ${synced} offline practices`);
        
        // Notify all clients about sync completion
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                syncedCount: synced
            });
        });
        
    } catch (error) {
        console.error('[SW] Failed to sync practices:', error);
    }
}

/**
 * Sync user progress to server
 */
async function syncUserProgress() {
    console.log('[SW] Syncing user progress...');
    
    try {
        const cache = await caches.open('offline-progress');
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            const progressData = await response.json();
            
            const syncResponse = await fetch('/api/user/progress/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(progressData)
            });
            
            if (syncResponse.ok) {
                await cache.delete(request);
            }
        }
        
        console.log(`[SW] Progress synced successfully`);
    } catch (error) {
        console.error('[SW] Failed to sync progress:', error);
    }
}

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', (event) => {
    console.log('[SW] Push notification received');
    
    let data = {
        title: 'SpeakFlow',
        body: 'Time to practice your English!',
        icon: '/images/icons/icon-192x192.png',
        badge: '/images/icons/badge-72x72.png',
        tag: 'practice-reminder',
        data: {
            url: '/'
        }
    };
    
    if (event.data) {
        try {
            data = Object.assign(data, event.data.json());
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            data: data.data,
            actions: [
                {
                    action: 'practice',
                    title: '🎤 Start Practice',
                    icon: '/images/icons/action-practice.png'
                },
                {
                    action: 'later',
                    title: '⏰ Remind Later',
                    icon: '/images/icons/action-later.png'
                }
            ],
            vibrate: [200, 100, 200],
            requireInteraction: true,
            silent: false
        })
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const action = event.action;
    const notificationData = event.notification.data;
    
    if (action === 'practice') {
        // Open the app and start practice
        event.waitUntil(
            clients.openWindow(notificationData.url || '/?action=practice')
        );
    } else if (action === 'later') {
        // Schedule reminder for later (15 minutes)
        event.waitUntil(
            scheduleReminder(15)
        );
    } else {
        // Default: open the app
        event.waitUntil(
            clients.openWindow(notificationData.url || '/')
        );
    }
});

/**
 * Schedule a reminder for later
 */
async function scheduleReminder(minutes) {
    // Store in IndexedDB for later
    const reminder = {
        id: Date.now(),
        scheduledTime: Date.now() + (minutes * 60 * 1000),
        type: 'practice_reminder'
    };
    
    // Use periodic sync if available
    if ('periodicSync' in self.registration) {
        try {
            await self.registration.periodicSync.register('reminder-sync', {
                minInterval: minutes * 60 * 1000
            });
        } catch (error) {
            console.log('Periodic sync not supported');
        }
    }
    
    // Store in cache for fallback
    const cache = await caches.open('reminders');
    await cache.put(`/reminders/${reminder.id}`, new Response(JSON.stringify(reminder)));
}

// ========== PERIODIC BACKGROUND SYNC ==========
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', (event) => {
        if (event.tag === 'daily-stats') {
            event.waitUntil(updateDailyStats());
        } else if (event.tag === 'reminder-sync') {
            event.waitUntil(checkReminders());
        }
    });
}

/**
 * Update daily statistics in background
 */
async function updateDailyStats() {
    console.log('[SW] Updating daily stats...');
    
    try {
        const response = await fetch('/api/analytics/daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                source: 'background_sync'
            })
        });
        
        if (response.ok) {
            console.log('[SW] Daily stats updated');
        }
    } catch (error) {
        console.error('[SW] Failed to update stats:', error);
    }
}

/**
 * Check and send pending reminders
 */
async function checkReminders() {
    const cache = await caches.open('reminders');
    const requests = await cache.keys();
    const now = Date.now();
    
    for (const request of requests) {
        const response = await cache.match(request);
        const reminder = await response.json();
        
        if (reminder.scheduledTime <= now) {
            // Send notification
            await self.registration.showNotification('SpeakFlow Reminder', {
                body: 'Time to practice your English! 🎤',
                icon: '/images/icons/icon-192x192.png',
                tag: `reminder-${reminder.id}`
            });
            
            // Remove from cache
            await cache.delete(request);
        }
    }
}

// ========== MESSAGE HANDLING ==========
self.addEventListener('message', (event) => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_PRACTICE':
            cacheOfflinePractice(data);
            break;
            
        case 'GET_CACHE_STATUS':
            getCacheStatus(event);
            break;
            
        case 'CLEAR_CACHE':
            clearOldCache();
            break;
            
        default:
            console.log('[SW] Unknown message type:', type);
    }
});

/**
 * Cache offline practice for later sync
 */
async function cacheOfflinePractice(practiceData) {
    const cache = await caches.open('offline-practices');
    const id = Date.now();
    const request = new Request(`/offline/practice/${id}`);
    await cache.put(request, new Response(JSON.stringify({
        id,
        ...practiceData,
        timestamp: new Date().toISOString()
    })));
    
    // Request background sync
    if ('sync' in self.registration) {
        await self.registration.sync.register('sync-practices');
    }
}

/**
 * Get cache status for debugging
 */
async function getCacheStatus(event) {
    const caches_list = await caches.keys();
    const status = {};
    
    for (const cacheName of caches_list) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        status[cacheName] = keys.length;
    }
    
    event.source.postMessage({
        type: 'CACHE_STATUS',
        data: status
    });
}

/**
 * Clear old cache data
 */
async function clearOldCache() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const cache = await caches.open(DYNAMIC_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
        const response = await cache.match(request);
        const cachedTime = new Date(response.headers.get('date')).getTime();
        
        if (cachedTime < oneWeekAgo) {
            await cache.delete(request);
        }
    }
    
    console.log(`[SW] Cleared ${requests.length} old cache entries`);
}

// ========== VERSION CHECK ==========
self.addEventListener('message', (event) => {
    if (event.data.type === 'CHECK_VERSION') {
        event.source.postMessage({
            type: 'VERSION_INFO',
            version: CACHE_NAME,
            timestamp: new Date().toISOString()
        });
    }
});

// Log service worker activation
console.log('[SW] Service Worker loaded successfully');
console.log(`[SW] Cache name: ${CACHE_NAME}`);
