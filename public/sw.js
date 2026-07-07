/* Gooodboys service worker — shows notifications and routes clicks. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/* Clicking a notification focuses the app on the right page. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/notifications";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { try { await c.navigate(link); } catch (e) {} return c.focus(); }
    }
    return self.clients.openWindow(link);
  })());
});

/* Server-sent Web Push (optional — needs a push server with VAPID). */
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(d.title || "Gooodboys", {
      body: d.body || "",
      icon: "/gb-mark.png",
      badge: "/gb-mark.png",
      data: { link: d.link || "/notifications" },
    })
  );
});
