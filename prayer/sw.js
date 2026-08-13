// Service worker for the prayer-times app.
//
// TO FORCE AN UPDATE ONTO THE PHONE: bump CACHE_VERSION, commit, push.
// The page checks for a new worker on every open (and every 15 minutes while
// open); a new worker installs, takes over immediately, and the page reloads
// itself. There is nothing to interrupt, so this is always safe.
const CACHE_VERSION = 'prayer-v8';
const SHELL = ['./', './index.html', './times.json', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const DIR = location.pathname.replace(/[^/]*$/, '');   // e.g. /quran-player/prayer/

self.addEventListener('install', (e) => {
  // cached one by one: a single missing file must not cost us offline support
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_VERSION);
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('prayer-') && k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only store a response that is really the thing we asked for. A hotel or
// airport wifi portal answers every request with 200 and its own login page;
// caching that would replace the app (or the prayer times) with rubbish.
function looksRight(resp, cacheKey) {
  if (!resp || !resp.ok || resp.redirected) return false;
  const type = resp.headers.get('content-type') || '';
  return cacheKey.endsWith('.json') ? type.includes('json') : type.includes('html');
}

// Network-first with a short timeout, so a hanging connection can never leave
// her looking at a blank screen; the cached copy wins instead.
async function freshFirst(req, cacheKey) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const resp = await Promise.race([
      fetch(req, { cache: 'no-store' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    if (looksRight(resp, cacheKey)) { cache.put(cacheKey, resp.clone()); return resp; }
    throw new Error('unusable response');
  } catch (e) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
    return fetch(req).catch(() => Response.error());
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (!url.pathname.startsWith(DIR)) return;          // only ever answer for our own folder

  if (req.mode === 'navigate') { e.respondWith(freshFirst(req, './index.html')); return; }
  if (url.pathname === DIR + 'times.json') { e.respondWith(freshFirst(req, './times.json')); return; }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
