
const CACHE_NAME = "billswipe-offline-v1";

const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#090810">
  <title>BillSwipe - Offline</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #090810;
      color: white;
      font-family: system-ui, sans-serif;
      text-align: center;
    }
    .card {
      max-width: 340px;
      padding: 36px;
      border: 1px solid #5b3a91;
      border-radius: 28px;
      background: #171126;
    }
    h1 { color: #a78bfa; }
    button {
      margin-top: 20px;
      padding: 13px 24px;
      border: 0;
      border-radius: 14px;
      background: #7c3aed;
      color: white;
      font-weight: bold;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>BILLSWIPE</h1>
    <h2>You're offline.</h2>
    <p>Reconnect to the internet to explore sponsorship opportunities.</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        "/__billswipe_offline__",
        new Response(OFFLINE_PAGE, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("billswipe-offline-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// Network-only for app requests; offline fallback only for navigation.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match("/__billswipe_offline__")) ||
          new Response("You're offline. Please reconnect.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      }
    })()
  );
});
