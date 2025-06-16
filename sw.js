// sw.js - Service Worker per l'applicazione LinkZen

/**
 * Nomi delle cache utilizzate:
 * - CACHE_NAME: Cache per le risorse statiche
 * - DYNAMIC_CACHE_NAME: Cache per le risorse dinamiche
 */
const CACHE_NAME = 'linkzen-v2.0';
const DYNAMIC_CACHE_NAME = 'linkzen-dynamic-v2';

/**
 * Elenco delle risorse statiche da memorizzare nella cache durante l'installazione
 */
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/main.js',
  '/icon16.png',
  '/icon48.png',
  '/icon128.png'
];

// =============================================
// Evento: install
// =============================================
/**
 * Gestisce l'evento di installazione del Service Worker.
 * Crea una cache per le risorse statiche e le precarica.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache statiche installate');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => console.error('Cache install error:', err))
  );
  
  // Forza l'attivazione immediata del nuovo Service Worker
  self.skipWaiting();
});

// =============================================
// Evento: activate
// =============================================
/**
 * Gestisce l'evento di attivazione del Service Worker.
 * Elimina le cache vecchie che non corrispondono ai nomi attuali.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => {
      // Prendi il controllo immediato di tutti i client
      return self.clients.claim();
    })
  );
});

// =============================================
// Evento: fetch
// =============================================
/**
 * Gestisce tutte le richieste di rete intercettate dal Service Worker.
 * Implementa diverse strategie di caching in base al tipo di richiesta.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ===========================================
  // CASO SPECIALE: Richieste jsQR
  // ===========================================
  /**
   * Gestione speciale per le richieste che contengono 'jsQR' nell'URL.
   * Utilizza una strategia Cache-First semplice.
   */
  if (event.request.url.includes('jsQR')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
    return;
  }

  // ===========================================
  // CASO SPECIALE: Richieste bookmarklet
  // ===========================================
  /**
   * Gestione speciale per le richieste con parametri bookmarklet.
   * Esegue sempre una richiesta di rete e aggiorna la cache.
   * In caso di fallimento, restituisce la pagina index.html dalla cache.
   */
  if (url.search.includes('bookmarklet=')) {
    event.respondWith(
      fetch(req).then(response => {
        const cache = caches.open(DYNAMIC_CACHE_NAME);
        cache.put(req, response.clone());
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // ===========================================
  // FILTRO: Ignora richieste non GET e chrome-extension
  // ===========================================
  /**
   * Ignora le richieste che non sono di tipo GET o che provengono
   * da estensioni Chrome.
   */
  if (req.method !== 'GET' || req.url.startsWith('chrome-extension://')) {
    return;
  }

  // ===========================================
  // CASO SPECIALE: Richieste favicon
  // ===========================================
  /**
   * Gestione speciale per le richieste di favicon.
   * Utilizza una strategia Cache-First con aggiornamento della cache.
   */
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

  // ===========================================
  // STRATEGIA PRINCIPALE: Cache con validazione
  // ===========================================
  /**
   * Strategia principale di gestione delle richieste:
   * - Per le pagine HTML: sempre richiesta di rete con fallback alla cache
   * - Per altre risorse: Cache-First con aggiornamento dalla rete
   */
  event.respondWith(
    caches.match(req).then(async (cachedRes) => {
      // =======================================
      // GESTIONE PAGINE HTML
      // =======================================
      /**
       * Per le richieste HTML, effettua sempre una richiesta di rete
       * per verificare la presenza di aggiornamenti.
       */
      if (req.headers.get('accept').includes('text/html')) {
        try {
          const fetchRes = await fetch(req);
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          cache.put(req, fetchRes.clone());
          return fetchRes;
        } catch (e) {
          // Fallback alla versione in cache o alla pagina principale
          return cachedRes || caches.match('/index.html');
        }
      }
      
      // =======================================
      // GESTIONE ALTRE RISORSE
      // =======================================
      /**
       * Per altre risorse (JS, CSS, immagini):
       * 1. Restituisci dalla cache se disponibile
       * 2. Altrimenti, recupera dalla rete e aggiorna la cache
       */
      if (cachedRes) return cachedRes;
      
      return fetch(req).then(async (fetchRes) => {
        if (fetchRes.ok) {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          cache.put(req, fetchRes.clone());
        }
        return fetchRes;
      }).catch(() => {
        // Solo per HTML: fallback alla pagina principale
        if (req.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});