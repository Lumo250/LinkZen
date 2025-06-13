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
  self.skipWaiting(); // Forza l'attivazione immediata
});

// Strategia di caching ottimizzata
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignora richieste non GET e chrome-extension://
  if (req.method !== 'GET' || req.url.startsWith('chrome-extension://')) {
    return;
  }

  // Gestione speciale per le favicon
  if (url.href.includes('s2/favicons')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        
        const response = await fetch(req);
        if (response.ok) cache.put(req, response.clone());
        return response;
      })
    );
    return;
  }

  // Gestione speciale per richieste con parametri (bookmarklet)
  if (url.search.includes('bookmarklet=') || url.search.includes('title=')) {
    event.respondWith(
      fetch(req).then(async (fetchRes) => {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        cache.put(req, fetchRes.clone());
        return fetchRes;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Strategia Cache-First con validazione
  event.respondWith(
    caches.match(req).then(async (cachedRes) => {
      // Always make network request for HTML to check for updates
      if (req.headers.get('accept').includes('text/html')) {
        try {
          const fetchRes = await fetch(req);
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          cache.put(req, fetchRes.clone());
          return fetchRes;
        } catch (e) {
          return cachedRes || caches.match('/index.html');
        }
      }
      
      // For other resources, return cached if available
      if (cachedRes) return cachedRes;
      
      return fetch(req).then(async (fetchRes) => {
        if (fetchRes.ok) {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          cache.put(req, fetchRes.clone());
        }
        return fetchRes;
      }).catch(() => {
        if (req.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Pulizia cache vecchie
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim(); // Prendi il controllo immediato di tutti i client
    })
  );
});
