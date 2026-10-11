// LESO LIFE offline support. Network first, so a new version shows up as soon as you are online;
// the saved copy is used when offline or when the network is too slow (3 s).
// Bump VERSION on every deploy.
var VERSION = 'leso-life-v1';
var FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
var SCOPE = new URL('./', self.location).href;
var OURS = FILES.map(function (f) { return new URL(f, SCOPE).href; });

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('leso-life-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url); url.search = ''; url.hash = '';
  // Only the app's own files; leave everything else on this site alone.
  if (OURS.indexOf(url.href) < 0) return;
  var isPage = req.mode === 'navigate' || url.href === SCOPE || url.href === SCOPE + 'index.html';
  var cached = function () { return caches.match(isPage ? './index.html' : req, { ignoreSearch: true }); };
  var fromNet = fetch(req);
  // Refresh the saved copy (clone before the page reads the body).
  e.waitUntil(fromNet.then(function (res) {
    if (!res || !res.ok || res.redirected) return;
    var copy = res.clone();
    return caches.open(VERSION).then(function (c) { return c.put(isPage ? './index.html' : req, copy); });
  }).catch(function () {}));
  // An error page from the server (404/5xx) is worse than the saved copy.
  var net = fromNet.then(function (res) { return res.ok ? res : cached().then(function (c) { return c || res; }); });
  var slow = new Promise(function (r) { setTimeout(r, 3000); }).then(cached);
  e.respondWith(Promise.race([net, slow.then(function (c) { return c || net; })]).catch(function () {
    return cached().then(function (c) { return c || net; });
  }));
});
