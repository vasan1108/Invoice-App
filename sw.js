const CACHE = 'gst-invoice-v6';
const PAGE = './invoice-app.html';
const SHELL = [PAGE, './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // MongoDB data always comes from the server, never from the cache.
  if (req.method !== 'GET' || !req.url.startsWith('http') || new URL(req.url).pathname.includes('/api/')) return;

  // Pages: newest copy when online, cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(PAGE, copy));
      }
      return res;
    }).catch(() => caches.match(PAGE)));
    return;
  }

  // Icons and Google Fonts: cache first, filled on first use.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  })));
});
