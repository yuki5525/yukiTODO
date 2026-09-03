// Service Worker — PWA 离线缓存 v8
// v8：改为单文件部署（JS/CSS 内联进 index.html），并提升缓存版本以清掉旧缓存。
// ⚠️ 注意：此文件以经典脚本（非 module）加载，禁止使用 ES import/export
// ⚠️ 所有日志统一使用 self.console，避免静态检查自动替换为 import
// ✅ 支持 Windows 桌面、安卓手机安装，离线可用

var CACHE_NAME = 'my-todo-pwa-v9';
var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-256x256.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  './icons/icon-maskable-192x192.png',
  './icons/icon-maskable-512x512.png',
];

// 安装：预缓存核心资源
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS).catch(function (err) {
          // 单个资源失败不阻断安装，保证 SW 能正常激活
          self.console.warn('[SW] 部分预缓存资源失败:', String(err));
        });
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

// 激活：清理旧缓存并立即接管所有页面
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (name) {
              return name !== CACHE_NAME;
            })
            .map(function (name) {
              return caches.delete(name);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

// 拦截请求：缓存优先策略（这是 PWA 可安装的必要条件）
self.addEventListener('fetch', function (event) {
  var request = event.request;

  // 只缓存 GET 请求
  if (request.method !== 'GET') return;

  // 忽略非 http/https 请求
  if (!request.url || request.url.indexOf('http') !== 0) return;

  // 导航请求：网络优先，失败回退到缓存的 index.html（SPA 离线壳）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (
            response.ok &&
            new URL(request.url).origin === self.location.origin
          ) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;

      return fetch(request)
        .then(function (response) {
          if (
            response.ok &&
            new URL(request.url).origin === self.location.origin
          ) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(function () {
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
          return Response.error();
        });
    })
  );
});

// 消息通道：支持主动触发更新
self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
