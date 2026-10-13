// Service worker for automatikhelp.com
//
// - Hele sitet (alle spil og sider) gemmes ved installation, så alt virker offline.
// - Sidens egne filer: network-first, så man altid får nyeste version, når man er online.
// - CDN-biblioteker og Google Fonts: gemmes og bruges fra cachen.
// - Alt andet (fx spillenes servere på *.systematisk.dk) går direkte til nettet og
//   caches ALDRIG - et spil må ikke få en gammel cloud-save serveret, når man er offline.

// <precache> (genereret af tools/update-sw.js - rediger ikke i hånden)
const VERSION = '46a9dc1546';
const PRECACHE = [
  "/",
  "/Automatikteknikker.ico",
  "/Monster_Energy.html",
  "/Pressure Drop/index.html",
  "/Pressure Drop/",
  "/automatikhjælpemidler.html",
  "/cas format/index.html",
  "/cas format/",
  "/filmguide/dc.html",
  "/filmguide/fastfurious.html",
  "/filmguide/harrypotter.html",
  "/filmguide/index.html",
  "/filmguide/",
  "/filmguide/jurassic.html",
  "/filmguide/lotr.html",
  "/filmguide/marvel.html",
  "/filmguide/starwars.html",
  "/filmguide/transformers.html",
  "/grejsalley/GREJSALLEY.html",
  "/grejsalley/Grejs-Base-Builder/css/style.css",
  "/grejsalley/Grejs-Base-Builder/index.html",
  "/grejsalley/Grejs-Base-Builder/",
  "/grejsalley/Grejs-Base-Builder/js/art-buildings.js",
  "/grejsalley/Grejs-Base-Builder/js/art-units.js",
  "/grejsalley/Grejs-Base-Builder/js/battle.js",
  "/grejsalley/Grejs-Base-Builder/js/core.js",
  "/grejsalley/Grejs-Base-Builder/js/home.js",
  "/grejsalley/Grejs-Base-Builder/js/render.js",
  "/grejsalley/Grejs-Base-Builder/js/ui.js",
  "/grejsalley/GrejsFarm.html",
  "/grejsalley/GrejsFigur.html",
  "/grejsalley/GrejsTank/css/style.css",
  "/grejsalley/GrejsTank/index.html",
  "/grejsalley/GrejsTank/",
  "/grejsalley/GrejsTank/js/ai.js",
  "/grejsalley/GrejsTank/js/audio.js",
  "/grejsalley/GrejsTank/js/cloud.js",
  "/grejsalley/GrejsTank/js/game.js",
  "/grejsalley/GrejsTank/js/levels.js",
  "/grejsalley/GrejsTank/js/main.js",
  "/grejsalley/GrejsTank/js/particles.js",
  "/grejsalley/GrejsTank/js/physics.js",
  "/grejsalley/GrejsTank/js/progress.js",
  "/grejsalley/GrejsTank/js/render.js",
  "/grejsalley/GrejsTank/js/save.js",
  "/grejsalley/GrejsTank/js/scenery.js",
  "/grejsalley/GrejsTank/js/tanks.js",
  "/grejsalley/GrejsTank/js/ui.js",
  "/grejsalley/GrejsTank/js/utils.js",
  "/grejsalley/GrejsTank/js/weapons.js",
  "/grejsalley/GrejsTank/js/worlds.js",
  "/grejsalley/GrejsVSZombies/css/style.css",
  "/grejsalley/GrejsVSZombies/index.html",
  "/grejsalley/GrejsVSZombies/",
  "/grejsalley/GrejsVSZombies/js/audio.js",
  "/grejsalley/GrejsVSZombies/js/core.js",
  "/grejsalley/GrejsVSZombies/js/game.js",
  "/grejsalley/GrejsVSZombies/js/main.js",
  "/grejsalley/GrejsVSZombies/js/plants.js",
  "/grejsalley/GrejsVSZombies/js/progression.js",
  "/grejsalley/GrejsVSZombies/js/ui.js",
  "/grejsalley/GrejsVSZombies/js/worlds.js",
  "/grejsalley/GrejsVSZombies/js/zombies.js",
  "/grejsalley/Grejs_Heroes.html",
  "/grejsalley/SuperGrejs/assets/images/icon.svg",
  "/grejsalley/SuperGrejs/css/game.css",
  "/grejsalley/SuperGrejs/css/menu.css",
  "/grejsalley/SuperGrejs/css/style.css",
  "/grejsalley/SuperGrejs/index.html",
  "/grejsalley/SuperGrejs/",
  "/grejsalley/SuperGrejs/js/api.js",
  "/grejsalley/SuperGrejs/js/app.js",
  "/grejsalley/SuperGrejs/js/art.js",
  "/grejsalley/SuperGrejs/js/audio.js",
  "/grejsalley/SuperGrejs/js/auth.js",
  "/grejsalley/SuperGrejs/js/bosses.js",
  "/grejsalley/SuperGrejs/js/characters.js",
  "/grejsalley/SuperGrejs/js/config.js",
  "/grejsalley/SuperGrejs/js/entities.js",
  "/grejsalley/SuperGrejs/js/game.js",
  "/grejsalley/SuperGrejs/js/input.js",
  "/grejsalley/SuperGrejs/js/levels-data.js",
  "/grejsalley/SuperGrejs/js/levels.js",
  "/grejsalley/SuperGrejs/js/physics.js",
  "/grejsalley/SuperGrejs/js/player.js",
  "/grejsalley/SuperGrejs/js/powerups.js",
  "/grejsalley/SuperGrejs/js/renderer.js",
  "/grejsalley/SuperGrejs/js/ui.js",
  "/grejsalley/SuperGrejs/js/util.js",
  "/grejsalley/SuperGrejs/manifest.webmanifest",
  "/grejsalley/cross_grejsworld_3d.html",
  "/grejsalley/dybe-gruber-deluxe.html",
  "/grejsalley/grejs-blasters.html",
  "/grejsalley/grejs-combat.html",
  "/grejsalley/grejs-crush.html",
  "/grejsalley/grejs-factory.html",
  "/grejsalley/grejs-forge.html",
  "/grejsalley/grejs-jetpack.html",
  "/grejsalley/grejs-nights.html",
  "/grejsalley/grejs-rider-3d.html",
  "/grejsalley/grejs-sport.html",
  "/grejsalley/grejsman-2d-kombat.html",
  "/grejsalley/img/grejs-base-builder.jpg",
  "/grejsalley/img/grejs-tanks-logo-neon.png",
  "/grejsalley/img/grejs-tanks-logo.png",
  "/grejsalley/img/grejs-vs-zombies.jpg",
  "/grejsalley/img/super-grejs.png",
  "/grejsalley/klassisk_neon_tetris.html",
  "/grejsalley/neon_snake.html",
  "/grejsalley/tap_tap_shots.html",
  "/grejsalley/tetris.js",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/index.html",
  "/manifest.webmanifest"
];
// </precache>

const CACHE = 'automatikhelp-' + VERSION;
const RUNTIME = 'automatikhelp-runtime';

const CDN = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  // CAS PDF til Word
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Én fil, der fejler, må ikke stoppe resten.
    await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    const runtime = await caches.open(RUNTIME);
    await Promise.allSettled(CDN.map(async (url) => {
      if (await runtime.match(url)) return;
      const res = await fetch(new Request(url, { mode: 'no-cors' }));
      await runtime.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event, req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req));
  }
  // Alt andet (API-kald osv.) håndteres ikke her og går direkte til nettet.
});

async function networkFirst(event, req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req), NETWORK_TIMEOUT);
    if (res.ok) event.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch (e) {
    // ignoreSearch: filer med ?v=... (cache-busting) findes i precachen uden query
    const cached = await cache.match(req, { ignoreSearch: true })
      || await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const home = await cache.match('/');
      if (home) return home;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  const update = fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') return cache.put(req, res.clone()).then(() => res);
    return res;
  });
  if (cached) {
    event.waitUntil(update.catch(() => {}));
    return cached;
  }
  return update;
}

// Hvis nettet "hænger" (dårlig wifi), skal vi hurtigt falde tilbage til cachen.
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
