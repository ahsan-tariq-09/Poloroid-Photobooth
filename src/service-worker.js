/* Generated at build time with an immutable asset list. */
const CACHE = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('poloroid-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/', { ignoreVary: true })));
    return;
  }
  if (!/^\/(assets\/|fonts\/|icons\/|textures\/|sample-(coast|flash)\.|favicon\.|manifest\.)/.test(url.pathname)) return;
  event.respondWith((async () => {
    // These are same-origin static files. Preview servers may emit Vary: Origin;
    // module requests carry Origin while the install-time fetch does not.
    const cache = await caches.open(CACHE), saved = await cache.match(request, { ignoreVary: true });
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
