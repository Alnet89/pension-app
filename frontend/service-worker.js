const CACHE_NAME = "pension-app-v1";
const URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/manifest.webmanifest"
];

// Instalación: cachear shell de la app
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

// Activación: limpiar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
});

// Fetch: servir desde cache si es posible, excepto backend
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // No interceptar la API del backend
  if (req.url.includes("localhost:3001")) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});