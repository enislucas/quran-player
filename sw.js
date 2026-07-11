// Minimal service worker: enables "Add to Home screen" installability.
// All requests pass straight through to the network (YouTube needs internet anyway).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
