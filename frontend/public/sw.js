// Only public, static recovery guidance is cached. Payment and profile requests
// always go to the network; private pages and receipts are never stored here.
const CACHE = "easy-pay-guidance-v2";
const PUBLIC_AUDIO = [
  "welcome",
  "recipient",
  "amount",
  "purpose",
  "review",
  "paused",
  "cancel",
  "receive",
  "bill",
  "history",
].map((key) => "/audio/kn/" + key + ".wav");
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["/offline.html", "/app-icon.svg", ...PUBLIC_AUDIO]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("easy-pay-guidance-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
  else if (PUBLIC_AUDIO.includes(new URL(event.request.url).pathname))
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request)),
    );
});
