const CACHE_NAME = "laborcoin-pwa-v25";

const APP_SHELL = [
  "/",
  "/index.html",
  "/exchange.html",
  "/dao.html",
  "/governance.html",
  "/onboarding.html",
  "/organizations.html",
  "/faq.html",
  "/disclaimer.html",
  "/whitepaper.html",
  "/whitepaper.pdf",
  "/donate.html",

  "/style.css",
  "/manifest.json",
  "/wallet.js",

  "/assets/favicon.png",
  "/assets/logo.png",
  "/assets/banner.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});