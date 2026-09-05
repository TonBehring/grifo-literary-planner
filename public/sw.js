const CACHE_NAME = "grifo-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Precisa responder ao fetch pra o navegador considerar o Grifo "instalável"
// (critério do Chrome/Android pra PWA) — sem cache agressivo por enquanto,
// só repassa pra rede e cai pro cache se ficar offline.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});

// Recebe a notificação push enviada pela Edge Function do Grifo e mostra
// pro usuário, mesmo com o app fechado. Também atualiza o número no ícone
// do app (Badging API) — funciona no iPhone (iOS/iPadOS 16.4+, app instalado
// e com permissão concedida); no Android o número já aparece sozinho,
// baseado nas notificações não dispensadas na bandeja.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Grifo", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Grifo";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96-comdot.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      try {
        if (typeof data.unreadCount === "number" && "setAppBadge" in navigator) {
          if (data.unreadCount > 0) {
            await navigator.setAppBadge(data.unreadCount);
          } else if ("clearAppBadge" in navigator) {
            await navigator.clearAppBadge();
          }
        }
      } catch {
        // Badging API não suportada nesse navegador/contexto — ignora.
      }
    })(),
  );
});

// Ao clicar na notificação, abre (ou foca) o Grifo na URL indicada.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
