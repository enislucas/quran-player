// Service worker: precaches the app shell and serves downloaded audio from
// the cache (with HTTP Range support, which <audio> needs for seeking).
// Audio files are downloaded and cached by the page itself (see index.html).
const SHELL_CACHE = 'quran-shell-v5';
const AUDIO_CACHE = 'quran-audio-v2';
const LEGACY_AUDIO_CACHE = 'quran-audio-v1';
const DIR = new URL('./', self.location.href).pathname;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // Preserve the already-downloaded Yaseen file while retiring the old
    // 44-part Quran cache. The new Juz layout must be downloaded afresh, and
    // deleting the old set first avoids briefly needing about 1.6 GB.
    if (keys.includes(LEGACY_AUDIO_CACHE)) {
      const oldCache = await caches.open(LEGACY_AUDIO_CACHE);
      const newCache = await caches.open(AUDIO_CACHE);
      const currentYaseen = new URL('audio/yaseen.m4a', self.location.href).href;
      const legacyYaseen = new URL('../audio/yaseen.m4a', self.location.href).href;
      const cachedYaseen = (await oldCache.match(currentYaseen)) || (await oldCache.match(legacyYaseen));
      if (cachedYaseen) await newCache.put(currentYaseen, cachedYaseen.clone());
    }
    // Only our own caches — Cache Storage is shared with the prayer app.
    await Promise.all(keys
      .filter((k) => k.startsWith('quran-') && k !== SHELL_CACHE && k !== AUDIO_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.indexOf('/audio/') !== -1) {
    e.respondWith(serveAudio(req));
    return;
  }

  if (req.mode === 'navigate') {
    // network-first so app updates arrive, but with a short timeout: on a
    // degraded connection (wifi up, internet down) fetch can hang for
    // minutes and the cached shell must win instead of a blank screen
    e.respondWith((async () => {
      try {
        const resp = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
        ]);
        // never let a 404 or an error page become the offline shell
        if (resp && resp.ok) {
          const c = await caches.open(SHELL_CACHE);
          c.put('./index.html', resp.clone());
        }
        return resp;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});

async function serveAudio(req) {
  const cache = await caches.open(AUDIO_CACHE);
  let cached = await cache.match(req.url, { ignoreSearch: true });
  if (!cached && new URL(req.url).pathname.startsWith(DIR + 'audio/')) {
    // still stored under the address used before this app moved into its own
    // folder; the page migrates these in the background, this covers the gap
    const legacy = req.url.replace(DIR + 'audio/', DIR.replace(/[^/]+\/$/, '') + 'audio/');
    cached = await cache.match(legacy, { ignoreSearch: true });
  }
  if (!cached) return fetch(req); // not downloaded yet: stream from network

  const range = req.headers.get('range');
  if (!range) return cached;

  // blob.slice() is lazy — no 18MB copies on the JS heap per seek
  const blob = await cached.blob();
  const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/i.exec(range);
  if (!m || (m[1] === '' && m[2] === '')) return new Response(blob, { status: 200, headers: baseHeaders(cached, size) });

  let start, end;
  if (m[1] === '') {           // suffix range: bytes=-N (last N bytes)
    const suffix = parseInt(m[2], 10);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(m[1], 10);
    end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
  }
  if (!(start >= 0) || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  const headers = baseHeaders(cached, end - start + 1);
  headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
  return new Response(blob.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: headers });
}

function baseHeaders(cached, length) {
  return {
    'Content-Type': cached.headers.get('Content-Type') || 'audio/mp4',
    'Content-Length': String(length),
    'Accept-Ranges': 'bytes',
  };
}
