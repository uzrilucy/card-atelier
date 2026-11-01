// 카드 아틀리에 서비스 워커 — 오프라인 실행용 캐시
// 릴리스마다 CACHE 값을 올려야 새 파일이 반영됩니다.
const CACHE = 'card-atelier-v0.1.1';
const SHELL = [
  './', 'index.html', 'manual.html', 'manifest.webmanifest', 'css/app.css',
  'fonts/pretendard/pretendardvariable-dynamic-subset.css', 'fonts/gowun/gowun-batang.css', 'fonts/jbmono/jbmono.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/store.js', 'js/porter.js', 'js/version.js',
  'js/core/codec.js', 'js/core/png.js', 'js/core/spec.js', 'js/core/diff.js', 'js/core/zip.js', 'js/core/db.js',
  'js/ui/manual.js', 'js/ui/dom.js', 'js/ui/icons.js', 'js/ui/nav.js',
  'js/views/common.js', 'js/views/shelf.js', 'js/views/card.js', 'js/views/lore.js', 'js/views/regex.js',
  'js/views/notes.js', 'js/views/versions.js', 'js/views/export.js', 'js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      // 글꼴 조각 등은 처음 쓰일 때 캐시에 담아 둠
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      throw err;
    }
  })());
});
