/* Service worker mínimo — só a casca do admin. Agenda continua online. */
const CACHE = "agenda-donnini-v2";
const PRECACHE = [
  "/admin.html",
  "/admin.css",
  "/admin.js",
  "/style.css",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  if (url.origin !== self.location.origin) return;
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(evento.request))
  );
});
