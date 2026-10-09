// Service worker for automatikhelp.com
// Network-first: altid nyeste version når man er online, cache som fallback offline.
const CACHE = 'automatikhelp-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/Automatikteknikker.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Gem sidens egne filer samt CDN-filer (Tailwind, fonts), så siden virker offline.
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('/');
          return Response.error();
        })
      )
  );
});
