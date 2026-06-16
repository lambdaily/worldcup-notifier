// Service Worker: recibe Web Push y muestra la notificación de gol
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Guardar último gol en Cache API para recuperarlo al abrir la app
async function saveLastGoal(data) {
  try {
    const cache = await caches.open("goal-notifier");
    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
    await cache.put("/last-goal", response);
  } catch (e) {}
}

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
    data: { url: `/?goal=${goalParam}`, goal: data },
  };

  event.waitUntil(
    (async () => {
      await saveLastGoal(data);
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      
      // Si hay ventanas abiertas, enviar mensaje directo
      if (clients.length > 0) {
        for (const c of clients) {
          c.postMessage({ type: "goal", ...data });
        }
      }
      
      // Siempre mostrar notificación (para cuando la app está en segundo plano)
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
