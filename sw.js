// sw.js - Service Worker per la PWA LinkZen

const CACHE_NAME = 'linkzen-v1.2';
const DYNAMIC_CACHE_NAME = 'linkzen-dynamic-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/popup.js',
  '/icon16.png',
  '/icon48.png',
  '/icon128.png',
  'https://www.google.com/s2/favicons?sz=16&domain_url=*' // Cache per le favicon
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
});

// Strategia Cache-First con fallback a rete
self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Ignora richieste non GET e chrome-extension://
  if (req.method !== 'GET' || req.url.startsWith('chrome-extension://')) {
    return;
  }

  // Gestione speciale per le favicon (cache dinamica)
  if (req.url.includes('s2/favicons')) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        return cached || fetch(req).then(res => {
          cache.put(req, res.clone());
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedRes) => {
      return cachedRes || fetch(req).then(async (fetchRes) => {
        // Cache dinamica per altre risorse
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        cache.put(req, fetchRes.clone());
        return fetchRes;
      }).catch(() => {
        // Fallback per HTML (solo per index.html)
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
    })
  );
});

// Gestione push notification (opzionale per feature future)
self.addEventListener('push', (event) => {
  // Puoi aggiungere logiche di notifica qui
});