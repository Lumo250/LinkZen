// sw.js - Service Worker ottimizzato per LinkZen
const CACHE_NAME = 'linkzen-v2.0';
const DYNAMIC_CACHE_NAME = 'linkzen-dynamic-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/main.js',
  '/icon16.png',
  '/icon48.png',
  '/icon128.png'
];

// Installazione: cache delle risorse statiche
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache statiche installate');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => console.error('Cache install error:', err))
  );
  self.skipWaiting();
});

// Strategia di caching ottimizzata
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Gestione richieste bookmarklet
  if (url.search.includes('bookmarklet=')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE_NAME)
            .then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Ignora richieste non GET e chrome-extension://
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Gestione speciale per le favicon
  if (url.href.includes('s2/favicons')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME)
        .then(async (cache) => {
          const cached = await cache.match(request);
          if (cached) return cached;
          
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
    );
    return;
  }

  // Strategia Cache-First con validazione per HTML
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      caches.match(request)
        .then(async (cachedResponse) => {
          try {
            const fetchResponse = await fetch(request);
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          } catch (e) {
            return cachedResponse || caches.match('/index.html');
          }
        })
    );
    return;
  }

  // Per altre risorse: Cache-First
  event.respondWith(
    caches.match(request)
      .then(async (cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(request)
          .then(async (fetchResponse) => {
            if (fetchResponse.ok) {
              const cache = await caches.open(DYNAMIC_CACHE_NAME);
              cache.put(request, fetchResponse.clone());
            }
            return fetchResponse;
          })
          .catch(() => {
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Pulizia cache vecchie
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
          .map(key => caches.delete(key))
      )
      .then(() => self.clients.claim())
  );
});
