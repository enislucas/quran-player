// Worker for the root page only.
//
// The Quran player used to be served from here, so an older worker may still
// be registered at this address on a phone, and a home-screen shortcut created
// back then still launches "/quran-player/". This worker replaces that old one
// and keeps the root page working offline, so such a shortcut still lands in
// the Quran app instead of an error page.
//
// It answers ONLY for the root page itself — never for quran/ or prayer/,
// which have their own workers — and it deletes no other cache, because the
// downloaded recitation lives in one of them.
const ROOT_CACHE = 'root-shell-v1';
const DIR = location.pathname.replace(/[^/]*$/, '');   // e.g. /quran-player/

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(ROOT_CACHE).then((c) => c.addAll(['./', './index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('root-') && k !== ROOT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname !== DIR && url.pathname !== DIR + 'index.html') return;

  e.respondWith((async () => {
    try {
      const resp = await Promise.race([
        fetch(req),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
      ]);
      if (resp && resp.ok) {
        const c = await caches.open(ROOT_CACHE);
        c.put('./index.html', resp.clone());
      }
      return resp;
    } catch (err) {
      return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
    }
  })());
});
