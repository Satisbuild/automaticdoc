// Grejs Budget service worker – gør appen brugbar uden internet.
//
// - Alle appfiler (HTML, CSS, JS, ikoner, logo) caches ved første besøg. Filerne er
//   versionsstyrede (?v=hash), så cache-first er sikkert.
// - Brugerens data ligger i IndexedDB og røres aldrig af service workeren – en opdatering
//   kan ikke slette dem.
// - En ny version venter, til brugeren vælger "Opdatér nu" i appen.
// - Der hentes aldrig noget fra andre servere.

// <precache> (genereret af scripts/stamp-service-worker.js - rediger ikke i hånden)
const VERSION = 'c04d6ca3b6';
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css?v=affcaadcaa",
  "css/responsive.css?v=c07f05756c",
  "css/print.css?v=36c54c7421",
  "js/theme-boot.js?v=486d9ce28d",
  "js/util.js?v=3714e01d23",
  "js/import.js?v=7179eb4ccb",
  "js/pdf-import.js?v=67aea17a37",
  "js/categorization.js?v=06f494b2d7",
  "js/transactions.js?v=33b00a8de3",
  "js/analytics.js?v=149d1eca18",
  "js/budgets.js?v=0ba083192e",
  "js/recurring.js?v=ab0c72fa2a",
  "js/insights.js?v=6d851271d1",
  "js/export.js?v=c0c23884d7",
  "js/sample-data.js?v=67bc009a96",
  "js/storage.js?v=b32eec458a",
  "js/ui.js?v=67e17b7292",
  "js/charts.js?v=d69cfafc98",
  "js/actions.js?v=c66c6da07f",
  "js/views/overview.js?v=a12721d126",
  "js/views/transactions.js?v=5e6a9b2e24",
  "js/views/insights.js?v=91e9f6e0c7",
  "js/views/categories.js?v=bcd4b699e3",
  "js/views/budgets.js?v=f6adc2ada7",
  "js/views/compare.js?v=38cadce1a5",
  "js/views/recurring.js?v=501926d68c",
  "js/views/goals.js?v=b55b89508e",
  "js/views/import.js?v=7a6c19b17e",
  "js/views/reports.js?v=3a4c29e5a5",
  "js/views/settings.js?v=53e1754f19",
  "js/app.js?v=f4ff8563db",
  "assets/grejs-budget-logo.png",
  "assets/icons/app-icon-192.png",
  "assets/icons/app-icon-512.png",
  "assets/icons/favicon.svg",
  "assets/libraries/pdfjs-6.4.299/pdf.min.js",
  "assets/libraries/pdfjs-6.4.299/pdf.worker.min.js",
  "assets/libraries/pdfjs-worker-loader.js"
];
// </precache>

const SHELL_CACHE = 'grejsbudget-shell-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('grejsbudget-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (req.mode === 'navigate') { event.respondWith(navigation(req)); return; }
  event.respondWith(cacheFirst(req));
});

async function navigation(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await withTimeout(fetch(req), 3500);
    if (res.ok) cache.put('index.html', res.clone());
    return res;
  } catch (e) {
    return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
  }
}

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
