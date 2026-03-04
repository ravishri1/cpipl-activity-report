/**
 * Service Worker for CPIPL HR System - Phase 1 Optimization
 * Implements cache-first strategy for assets and network-first for API calls
 * Expected cache size: ~50-100MB for typical usage
 */

const CACHE_PREFIX = 'cpipl-hr-v1';
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;
const API_CACHE = `${CACHE_PREFIX}-api`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic`;

const CACHES_TO_DELETE = [
  'cpipl-hr-v0',
  'cpipl-hr-assets-v0',
  'cpipl-hr-api-v0',
];

// Assets to pre-cache on install (critical rendering path)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
];

/**
 * Install Event: Set up caches
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    caches.open(ASSET_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(err => console.error('[SW] Precache failed:', err))
  );
  
  // Skip waiting - activate immediately
  self.skipWaiting();
});

/**
 * Activate Event: Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => CACHES_TO_DELETE.includes(name) || 
                           (name.startsWith(CACHE_PREFIX) && 
                            ![ASSET_CACHE, API_CACHE, DYNAMIC_CACHE].includes(name)))
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim()) // Claim all clients immediately
  );
});

/**
 * Fetch Event: Route requests to appropriate caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and external requests
  if (url.protocol === 'chrome-extension:' || url.origin !== self.location.origin) {
    return;
  }

  // ═══ API Requests: Network-first, fallback to cache ═══
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const cache = url.pathname.startsWith('/api/auth') ? DYNAMIC_CACHE : API_CACHE;
            const clonedResponse = response.clone();
            caches.open(cache).then(c => c.put(request, clonedResponse));
          }
          return response;
        })
        .catch(() => {
          // Fall back to cached response on network failure
          return caches.match(request)
            .then(cached => cached || createOfflineResponse());
        })
    );
  }

  // ═══ Static Assets: Cache-first, fallback to network ═══
  if (isStaticAsset(url.pathname)) {
    return event.respondWith(
      caches.match(request)
        .then((cached) => cached || fetch(request)
          .then((response) => {
            // Cache new assets
            if (response.ok) {
              const clonedResponse = response.clone();
              caches.open(ASSET_CACHE).then(c => c.put(request, clonedResponse));
            }
            return response;
          })
          .catch(() => createOfflineResponse())
        )
    );
  }

  // ═══ HTML Pages: Network-first, fallback to cache ═══
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open(DYNAMIC_CACHE).then(c => c.put(request, clonedResponse));
          }
          return response;
        })
        .catch(() => caches.match(request)
          .then(cached => cached || createOfflineResponse())
        )
    );
  }
});

/**
 * Helper: Check if URL is a static asset
 */
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot)(\?.*)?$/.test(pathname);
}

/**
 * Helper: Create offline response
 */
function createOfflineResponse() {
  return new Response('Offline - Please check your connection', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: new Headers({
      'Content-Type': 'text/plain',
    }),
  });
}

/**
 * Background Sync: Queue for retry when offline (future enhancement)
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  // Implementation for offline-first mutations can be added here
});

console.log('[SW] Service Worker loaded and ready');
