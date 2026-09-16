// Cache version is auto-bumped by GitHub Actions on every push — do not edit manually.
const CACHE = 'workouts-20260726152436';
const ASSETS = [
  './',
  './index.html',
  './enhancements.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function withEnhancements(response) {
  if (!response || !response.ok) return response;
  const html = await response.text();
  if (html.includes('enhancements.js')) {
    return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  const enhanced = html.replace('</body>', '<script src="./enhancements.js"></script>\n</body>');
  return new Response(enhanced, { status: response.status, statusText: response.statusText, headers: response.headers });
}

// Fetch: serve from cache, fall back to network. Inject small runtime enhancements
// into the app shell so the main single-file app can stay unchanged.
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(e.request)
        .then(cached => cached || caches.match('./index.html'))
        .then(cached => cached || fetch(e.request))
        .then(withEnhancements)
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
