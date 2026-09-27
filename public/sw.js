/**
 * AgroCycle Offline-First Service Worker
 * Caches Application Shell, Local YOLO11n ONNX Model, and Local WASM Runtime Binaries.
 */

const CACHE_NAME = "agrocycle-offline-v1";

// Critical core assets to pre-cache on install for offline functionality
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/models/agrocycle_yolo11n.onnx",
  "/wasm/ort-wasm-simd-threaded.wasm",
  "/wasm/ort-wasm-simd-threaded.mjs",
  "/wasm/ort-wasm-simd-threaded.jsep.wasm",
  "/wasm/ort-wasm-simd-threaded.jsep.mjs",
  "/wasm/ort-wasm-simd-threaded.asyncify.wasm",
  "/wasm/ort-wasm-simd-threaded.asyncify.mjs",
  "/wasm/ort-wasm-simd-threaded.jspi.wasm",
  "/wasm/ort-wasm-simd-threaded.jspi.mjs",
  "/03gb.jpg",
  "/35589125035_662dd5b258_b.jpg",
  "/5-29black-rot-chardRR.jpg",
  "/LateBlight04.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("[ServiceWorker] Pre-caching core offline assets & YOLO model...");
      // Cache assets individually so failure of an optional asset doesn't break installation
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[ServiceWorker] Optional asset failed to pre-cache: ${asset}`, err.message);
        }
      }
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[ServiceWorker] Removing obsolete cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (e.g. POST/PUT)
  if (request.method !== "GET") {
    return;
  }

  // 2. External API Requests (Gemini, Google AI, PMFBY external link) -> Network only with graceful fallback
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return 503 Service Unavailable for offline external APIs
        return new Response(JSON.stringify({ error: "Offline: Network request unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    return;
  }

  // 3. Navigation Requests (SPA Route loads, reloads on /viability-scanner, /claim-rocket, etc.)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match("/index.html") || await cache.match("/");
        return cachedIndex || new Response("AgroCycle is offline. Please refresh once online to initialize.", {
          status: 200,
          headers: { "Content-Type": "text/html" }
        });
      })
    );
    return;
  }

  // 4. Local Model Binary & WASM Assets (/models/ and /wasm/) -> Cache-First Strategy
  if (url.pathname.startsWith("/models/") || url.pathname.startsWith("/wasm/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          console.warn(`[ServiceWorker] Failed to fetch offline binary ${url.pathname}:`, err);
          throw err;
        }
      })
    );
    return;
  }

  // 5. Static Assets (JS, CSS, Images, Fonts, Icons) -> Stale-While-Revalidate Strategy
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch((err) => {
        // Network failed (offline)
        return null;
      });

      return cachedResponse || (await fetchPromise);
    })
  );
});
