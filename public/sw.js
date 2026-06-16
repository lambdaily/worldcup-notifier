// Service Worker: recibe Web Push y muestra la notificación de gol
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data.json(); } catch (e) {}

  const title = `⚽ ¡GOL de ${data.team || "alguien"}!`;
  const body = `${data.homeName} ${data.score} ${data.awayName}${data.minute ? "  ·  " + data.minute : ""}`;
  const goalParam = encodeURIComponent(JSON.stringify(data));

  const options = {
    body,
    icon: data.flag || "icon.png",
    badge: "icon.png",
    image: data.flag,
    vibrate: [200, 80, 200, 80, 400],
    tag: "goal",
    renotify: true,
    data: { url: `/?goal=${goalParam}` },
  };

  event.waitUntil(
    (async () => {
      // Si hay una ventana abierta, dispara la animación directamente
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) c.postMessage({ type: "goal", ...data });
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
