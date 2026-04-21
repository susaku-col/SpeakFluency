// ============================================
// SpeakFlow Service Worker v1.0.0
// Progressive Web App dengan Offline Support
// ============================================

const CACHE_NAME = 'speakflow-v1.0.0';
const OFFLINE_CACHE = 'speakflow-offline-v1';
const DYNAMIC_CACHE = 'speakflow-dynamic-v1';
const AUDIO_CACHE = 'speakflow-audio-v1';

// Assets yang akan di-cache saat install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  
  // CSS Files
  '/css/main.css',
  '/css/components.css',
  '/css/dashboard.css',
  '/css/admin.css',
  '/css/mobile.css',
  '/css/themes/light.css',
  '/css/themes/dark.css',
  
  // JS Files
  '/js/app.js',
  '/js/auth.js',
  '/js/voice.js',
  '/js/ai-model.js',
  '/js/analytics.js',
  '/js/ab-testing.js',
  '/js/marketing.js',
  '/js/support.js',
  '/js/srs.js',
  '/js/gamification.js',
  '/js/payment.js',
  '/js/offline.js',
  '/js/pwa.js',
  '/js/onboarding.js',
  '/js/utils.js',
  
  // Images
  '/public/images/logo.svg',
  '/public/images/favicon.ico',
  '/public/images/hero-bg.jpg',
  '/public/images/og-image.jpg',
  
  // Icons
  '/public/images/icons/icon-72x72.png',
  '/public/images/icons/icon-96x96.png',
  '/public/images/icons/icon-128x128.png',
  '/public/images/icons/icon-144x144.png',
  '/public/images/icons/icon-152x152.png',
  '/public/images/icons/icon-192x192.png',
  '/public/images/icons/icon-384x384.png',
  '/public/images/icons/icon-512x512.png',
  
  // Audio (basic)
  '/public/audio/correct.mp3',
  '/public/audio/incorrect.mp3',
  '/public/audio/level-up.mp3',
  '/public/audio/notification.mp3',
  
  // Fonts
  '/public/fonts/inter.woff2',
  '/public/fonts/inter.woff'
];

// API endpoints yang tidak perlu di-cache (dynamic)
const EXCLUDED_API_PATTERNS = [
  '/api/auth',
  '/api/payments',
  '/api/analytics',
  '/api/sessions/practice',
  '/api/voice/analyze'
];

// File extensions yang tidak perlu di-cache
const EXCLUDED_EXTENSIONS = ['.mp4', '.pth', '.h5', '.pb'];

// ============================================
// EVENT: INSTALL
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    (async () => {
      // Skip waiting to activate immediately
      self.skipWaiting();
      
      // Open cache and add static assets
      const cache = await caches.open(CACHE_NAME);
      console.log('[SW] Caching static assets');
      
      // Add each asset individually to handle failures
      const cachePromises = STATIC_ASSETS.map(async (asset) => {
        try {
          const response = await fetch(asset);
          if (response.ok) {
            await cache.put(asset, response);
            console.log(`[SW] Cached: ${asset}`);
          } else {
            console.warn(`[SW] Failed to cache: ${asset} (${response.status})`);
          }
        } catch (error) {
          console.error(`[SW] Error caching ${asset}:`, error);
        }
      });
      
      await Promise.allSettled(cachePromises);
      console.log('[SW] Installation complete!');
    })()
  );
});

// ============================================
// EVENT: ACTIVATE
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    (async () => {
      // Claim clients to take control immediately
      await self.clients.claim();
      
      // Delete old caches
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name => 
        name !== CACHE_NAME && 
        name !== OFFLINE_CACHE && 
        name !== DYNAMIC_CACHE && 
        name !== AUDIO_CACHE
      );
      
      await Promise.all(
        oldCaches.map(name => {
          console.log(`[SW] Deleting old cache: ${name}`);
          return caches.delete(name);
        })
      );
      
      console.log('[SW] Activation complete!');
    })()
  );
});

// ============================================
// HELPER: Should exclude from cache
// ============================================
function shouldExcludeFromCache(url) {
  // Check excluded patterns
  for (const pattern of EXCLUDED_API_PATTERNS) {
    if (url.includes(pattern)) {
      return true;
    }
  }
  
  // Check excluded extensions
  for (const ext of EXCLUDED_EXTENSIONS) {
    if (url.endsWith(ext)) {
      return true;
    }
  }
  
  return false;
}

// ============================================
// HELPER: Get cache strategy
// ============================================
function getCacheStrategy(url) {
  // Audio files - Cache First with network fallback
  if (url.includes('/audio/') || url.includes('.mp3') || url.includes('.wav')) {
    return 'CACHE_FIRST';
  }
  
  // API endpoints - Network First with cache fallback
  if (url.includes('/api/')) {
    return 'NETWORK_FIRST';
  }
  
  // Images - Stale While Revalidate
  if (url.includes('/images/') || url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
    return 'STALE_WHILE_REVALIDATE';
  }
  
  // Static assets - Cache First
  return 'CACHE_FIRST';
}

// ============================================
// HELPER: Network First Strategy
// ============================================
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName || DYNAMIC_CACHE);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful response
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log(`[SW] Network failed for ${request.url}, trying cache...`);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// ============================================
// HELPER: Cache First Strategy
// ============================================
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName || CACHE_NAME);
  
  // Try cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Then network
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log(`[SW] Network failed for ${request.url}`);
    
    // Return offline page for HTML
    if (request.headers.get('accept').includes('text/html')) {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// ============================================
// HELPER: Stale While Revalidate
// ============================================
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName || DYNAMIC_CACHE);
  
  // Get cached response
  const cachedResponse = await cache.match(request);
  
  // Fetch new response in background
  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(error => {
    console.log(`[SW] Background revalidate failed for ${request.url}`);
  });
  
  // Return cached response immediately if exists
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Otherwise wait for network
  return fetchPromise;
}

// ============================================
// HELPER: Background Sync for Offline Actions
// ============================================
async function handleBackgroundSync(tag) {
  console.log(`[SW] Background sync triggered: ${tag}`);
  
  if (tag === 'sync-practice-sessions') {
    const cache = await caches.open(OFFLINE_CACHE);
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('/api/sessions')) {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.delete(request);
            console.log(`[SW] Synced offline session: ${request.url}`);
          }
        } catch (error) {
          console.error(`[SW] Failed to sync: ${request.url}`, error);
        }
      }
    }
  }
}

// ============================================
// EVENT: FETCH
// ============================================
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip excluded patterns
  if (shouldExcludeFromCache(url)) {
    console.log(`[SW] Skipping cache for: ${url}`);
    return;
  }
  
  // Get cache strategy
  const strategy = getCacheStrategy(url);
  
  console.log(`[SW] ${strategy} for: ${url}`);
  
  switch (strategy) {
    case 'NETWORK_FIRST':
      event.respondWith(networkFirst(request, DYNAMIC_CACHE));
      break;
      
    case 'STALE_WHILE_REVALIDATE':
      event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
      break;
      
    case 'CACHE_FIRST':
    default:
      event.respondWith(cacheFirst(request, CACHE_NAME));
      break;
  }
});

// ============================================
// EVENT: MESSAGE (from client)
// ============================================
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_AUDIO':
      // Cache audio lesson file
      if (data && data.url) {
        event.waitUntil(
          (async () => {
            const cache = await caches.open(AUDIO_CACHE);
            const response = await fetch(data.url);
            await cache.put(data.url, response);
            console.log(`[SW] Cached audio: ${data.url}`);
          })()
        );
      }
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        (async () => {
          await caches.delete(CACHE_NAME);
          await caches.delete(DYNAMIC_CACHE);
          console.log('[SW] Cache cleared');
        })()
      );
      break;
      
    case 'GET_CACHE_SIZE':
      event.waitUntil(
        (async () => {
          const cache = await caches.open(CACHE_NAME);
          const keys = await cache.keys();
          event.source.postMessage({
            type: 'CACHE_SIZE',
            data: { size: keys.length }
          });
        })()
      );
      break;
      
    default:
      console.log(`[SW] Unknown message type: ${type}`);
  }
});

// ============================================
// EVENT: SYNC (Background Sync)
// ============================================
self.addEventListener('sync', (event) => {
  console.log(`[SW] Sync event: ${event.tag}`);
  
  if (event.tag === 'sync-practice-sessions') {
    event.waitUntil(handleBackgroundSync(event.tag));
  }
});

// ============================================
// EVENT: PUSH NOTIFICATION
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'SpeakFlow',
    body: 'Time to practice your speaking!',
    icon: '/public/images/icons/icon-192x192.png',
    badge: '/public/images/icons/icon-96x96.png',
    tag: 'speakflow-notification',
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'practice',
        title: 'Start Practice 🎤'
      },
      {
        action: 'later',
        title: 'Later'
      }
    ]
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (error) {
      console.error('[SW] Failed to parse push data:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      vibrate: data.vibrate,
      actions: data.actions,
      data: {
        url: data.url || '/'
      }
    })
  );
});

// ============================================
// EVENT: NOTIFICATION CLICK
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      
      // Check if there's already a window/tab open
      for (const client of clients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })()
  );
});

// ============================================
// EVENT: PERIODIC BACKGROUND SYNC (Optional)
// ============================================
self.addEventListener('periodicsync', (event) => {
  console.log(`[SW] Periodic sync: ${event.tag}`);
  
  if (event.tag === 'update-content') {
    event.waitUntil(
      (async () => {
        // Update cached content
        const cache = await caches.open(DYNAMIC_CACHE);
        
        // Refresh dashboard data
        try {
          const response = await fetch('/api/dashboard/stats');
          if (response.ok) {
            await cache.put('/api/dashboard/stats', response);
            console.log('[SW] Periodic sync: Dashboard stats updated');
          }
        } catch (error) {
          console.error('[SW] Periodic sync failed:', error);
        }
      })()
    );
  }
});

// ============================================
// UTILITY: Log cache status
// ============================================
self.addEventListener('activate', () => {
  (async () => {
    const cacheNames = await caches.keys();
    console.log('[SW] Active caches:', cacheNames);
    
    // Send cache status to clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_STATUS',
        data: { caches: cacheNames }
      });
    });
  })();
});

// ============================================
// OFFLINE FALLBACK HTML
// ============================================
// You need to create an offline.html file
const offlineHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Offline - SpeakFlow</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
        }
        .container {
            padding: 20px;
        }
        .emoji {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }
        p {
            font-size: 18px;
            opacity: 0.9;
        }
        button {
            background: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 20px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">📡</div>
        <h1>You're Offline</h1>
        <p>Please check your internet connection<br>and try again.</p>
        <button onclick="location.reload()">Retry Connection</button>
    </div>
</body>
</html>`;

// Cache offline page if needed
self.addEventListener('install', () => {
  const offlineResponse = new Response(offlineHTML, {
    headers: { 'Content-Type': 'text/html' }
  });
  caches.open(CACHE_NAME).then(cache => {
    cache.put('/offline.html', offlineResponse);
  });
});

// ============================================
// EXPORT FOR DEBUGGING
// ============================================
console.log('[SW] Service Worker loaded successfully');
