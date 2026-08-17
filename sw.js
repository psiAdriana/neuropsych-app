// ══════════════════════════════════════════
// Service Worker — Plataforma Neuropsicológica
// Versión: 7.0
// Cachea todos los assets para uso offline.
// ══════════════════════════════════════════

const CACHE_NAME = 'neuropsych-v7';

// Assets a cachear en la instalación
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.jsx',
  '/manifest.json',
  // CDNs de React y Babel
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js',
];

// Instalar: pre-cachear assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Pre-cacheando assets...');
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.warn('[SW] Error pre-cacheando:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: Cache-first para assets locales, Network-first para API
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // API de Anthropic → siempre ir a la red (nunca cachear)
  if (url.hostname.includes('anthropic.com')) {
    return; // pasa directo sin interceptar
  }

  // Para el resto: Cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // Solo cachear respuestas exitosas de recursos estáticos
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        // Cachear una copia
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });

        return response;
      }).catch(function() {
        // Si no hay red y no está en caché, mostrar offline simple para HTML
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Escuchar mensajes del cliente (para forzar actualización)
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
