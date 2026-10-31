// ==============================================================================
// ANIME-PLOT STUDIO - SERVICE WORKER (PWA OFFLINE & ASSET CACHING)
// ==============================================================================

const CACHE_NAME = 'anime-plot-studio-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/components.js',
  '/js/app.js',
  '/manifest.json',
  '/assets/logo.jpg',
  '/assets/studio_hero_banner.jpg',
  '/assets/scene_library_discovery.jpg',
  '/assets/scene_rooftop_sunset.jpg',
  '/assets/scene_clocktower_lightning.jpg',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png',
  '/assets/icon-maskable-192x192.png',
  '/assets/icon-maskable-512x512.png',
  '/assets/apple-touch-icon.png',
  '/assets/favicon-32x32.png',
  '/assets/favicon-16x16.png'
];

// Install Event - Pre-cache core shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Dynamic caching strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests (e.g. POST uploads, creates)
  if (req.method !== 'GET') {
    return;
  }

  // Strategy 1: API requests -> Network First, fall back to cached data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          // Clone and cache successful API responses
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          // If offline, serve cached API response if available
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({
              success: false,
              offline: true,
              message: 'You are currently offline. Displaying cached studio data.'
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Strategy 2: Uploads & Images -> Stale-while-revalidate / Cache First
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Fetch update in background
          fetch(req).then((netRes) => {
            if (netRes && netRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, netRes));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(req).then((netRes) => {
          if (netRes && netRes.status === 200) {
            const clone = netRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return netRes;
        });
      })
    );
    return;
  }

  // Strategy 3: HTML / Core static assets -> Network first with cache fallback
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});
