/**
 * Service Worker de Web Push (spec 0022).
 *
 * Só `push`, `notificationclick` e `pushsubscriptionchange`. NÃO registra
 * `fetch` de propósito: um SW na raiz intercepta o site inteiro, e cache de
 * navegação aqui serviria HTML velho num app com centenas de rotas (D-5).
 */

self.addEventListener("install", () => {
  // Assume o controle sem esperar as abas antigas fecharem.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Push sem JSON não deveria acontecer, mas não vale perder o aviso.
    payload = { title: "Nova notificação", body: event.data.text() };
  }

  const title = payload.title || "Nova notificação";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/favicon.png",
    badge: "/favicon.png",
    // Mesma tag substitui a anterior em vez de empilhar avisos do mesmo assunto.
    tag: payload.tag || undefined,
    data: { url: payload.url || "/", ...(payload.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Foca uma aba do app em vez de abrir outra (CA-8).
        for (const client of clientList) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          return client.focus().then((focused) =>
            focused.navigate ? focused.navigate(targetUrl) : focused,
          );
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

/**
 * O browser pode rodar a inscrição sozinho (expiração, rotação). Sem isto a
 * inscrição no banco vira lixo silencioso e o usuário para de receber (CB-7).
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey =
        (event.oldSubscription && event.oldSubscription.options
          ? event.oldSubscription.options.applicationServerKey
          : null) || null;

      if (!applicationServerKey) return;

      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const raw = subscription.toJSON();
      await fetch("/api/rpc/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          json: {
            endpoint: subscription.endpoint,
            keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
            userAgent: self.navigator ? self.navigator.userAgent : null,
          },
        }),
      });
    })(),
  );
});
