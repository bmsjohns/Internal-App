// Offline support for the day-of call sheet (Events Phase 2 spec §6.3).
// Deliberately narrow: this app has NO general offline requirement — only
// /callsheet/* must survive losing signal backstage.
//
// Everything is network-first with a cache fallback — including static
// assets. Cache-first would be marginally faster for production's hashed
// chunks, but next dev serves UNhashed chunk URLs whose content changes on
// every recompile, and a cache-first SW then pins the whole app to stale
// JS/CSS (learned the hard way). Network-first behaves correctly in both:
// online you always get the current build, offline you get the last good one.
const PAGES = "ob-callsheet-pages-v2";
const STATIC = "ob-static-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, STATIC];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw new Error("offline and not cached");
  }
}

// First-visit priming: the SW only intercepts navigations AFTER it's
// installed, so the very first "load it once on venue wifi" visit wouldn't
// be cached until a reload. The page posts its own URL here to close that gap.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type !== "cache-page" || typeof data.url !== "string") return;
  const prime = (async () => {
    const url = new URL(data.url);
    if (url.origin !== location.origin || !url.pathname.startsWith("/callsheet/")) return;
    const cache = await caches.open(PAGES);
    const res = await fetch(data.url);
    if (res.ok) await cache.put(data.url, res);
  })();
  if (event.waitUntil) event.waitUntil(prime);
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === "navigate" && url.pathname.startsWith("/callsheet/")) {
    event.respondWith(networkFirst(request, PAGES));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/assets/")) {
    event.respondWith(networkFirst(request, STATIC));
  }
});
