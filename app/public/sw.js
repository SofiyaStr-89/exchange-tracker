// Офлайн-оболочка (шаг 12): приложение открывается без сети.
// Страница — сначала из сети (чтобы сразу получать новую версию), без сети — из кэша.
// Файлы сборки /assets/* с хешем в имени — из кэша. /api/* и чужие сайты (тайлы, поиск) не кэшируем.

const CACHE = 'shell-v1';
// Файлы запрашиваются с crossorigin (заголовок Origin), а сервер может ответить «Vary: Origin» — тогда кэш их не находит.
const MATCH = { ignoreVary: true };
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png', '/icons/icon.svg'];

const assetsOf = (html) => [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])];

async function cacheShell() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const html = await (await cache.match('/', MATCH)).text();
  await cache.addAll(assetsOf(html));
}

/** Свежая страница: запомнить её и её файлы, старые файлы сборки удалить. */
async function updateShell(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  const assets = assetsOf(html);
  await cache.put('/', response);
  await Promise.all(assets.map(async (url) => (await cache.match(url, MATCH)) || cache.add(url).catch(() => {})));
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/assets/') && !assets.includes(path)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) event.waitUntil(updateShell(response.clone()));
          return response;
        })
        .catch(async () => (await caches.match('/', MATCH)) ?? Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request, MATCH).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && url.pathname.startsWith('/assets/')) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
