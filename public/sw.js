/*
 * RAAHI service worker.
 *
 * Built for people on intermittent mobile data: the app shell and the pages
 * already visited must keep working when the network drops.
 *
 * Deliberately conservative:
 *  - Only GET requests, only same-origin.
 *  - Never caches /api responses. Live data (deadlines, camps, blood
 *    requests) must not be served stale — a wrong answer about a deadline or
 *    a blood bank is worse than no answer at all.
 *  - Static assets are cache-first because Next.js content-hashes them.
 *  - Pages are network-first, so a visitor online always gets the current
 *    version, and only falls back to the cache when offline.
 */

const VERSION = "raahi-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/raahi.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("raahi-") && !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle plain GETs for our own origin.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live data is never cached.
  if (url.pathname.startsWith("/api/")) return;

  // Next.js content-hashes these: safe to treat as immutable.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Navigations: prefer the network, fall back to the cache, then offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline ?? new Response("Offline", { status: 503 });
        }),
    );
  }
});

// Let the page trigger an update without a reload loop.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
