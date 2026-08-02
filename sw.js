/* =========================================================================
   Coachly — Service Worker
   Met en cache la coquille de l'app pour un fonctionnement 100% hors-ligne,
   et affiche les notifications de rappel quotidien.
   ========================================================================= */

const CACHE = "coachly-v4";
const ASSETS = [
  ".",
  "index.html",
  "css/styles.css",
  "js/data.js",
  "js/store.js",
  "js/coach.js",
  "js/program.js",
  "js/nutrition.js",
  "js/chat.js",
  "js/reminders.js",
  "js/app.js",
  "manifest.webmanifest",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Stratégie : cache d'abord (app locale), réseau en secours. */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).catch(() => caches.match("index.html"))
    )
  );
});

/* Rappel quotidien : la page envoie un message { type:"notify", ... } */
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "notify") {
    self.registration.showNotification(d.title || "Coachly", {
      body: d.body || "C'est l'heure de ton check-in !",
      icon: "assets/icon-192.png",
      badge: "assets/icon-192.png",
      tag: "coachly-daily",
      renotify: true,
    });
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow(".");
    })
  );
});
