const CACHE = 'metrack-shell-v1';
const SHELL = '/index.html';
const PASS_THROUGH = ['/api', '/u', '/privacy'];

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (
    PASS_THROUGH.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix + '/'))
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(assetFirst(request));
  }
});

async function precache() {
  const cache = await caches.open(CACHE);
  const response = await fetch(SHELL, { cache: 'reload' });
  if (!response.ok) throw new Error('shell unavailable');
  const html = await response.clone().text();
  await cache.put(SHELL, response);
  const assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])];
  await Promise.all(
    assets.map(async (path) => {
      const asset = await fetch(path);
      if (asset.ok) await cache.put(path, asset);
    }),
  );
}

async function navigate(request) {
  try {
    const response = await fetch(request);
    if (response.ok && (response.headers.get('content-type') ?? '').includes('text/html')) {
      const cache = await caches.open(CACHE);
      await cache.put(SHELL, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(SHELL);
    if (cached) return cached;
    throw error;
  }
}

async function assetFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && !(response.headers.get('content-type') ?? '').includes('text/html')) {
    await cache.put(request, response.clone());
  }
  return response;
}
