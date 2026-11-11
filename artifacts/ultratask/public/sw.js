// UltraTask service worker: offline shell only. API calls always go to network.
const CACHE = 'ultratask-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/logo.svg', '/icon-192.png', '/ultramotiv-logo.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api')) return;
  if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match('/'))); return; }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok && /\.(png|svg|woff2?)$/.test(url.pathname)) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return res; })));
});
