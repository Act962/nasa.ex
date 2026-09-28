/**
 * Camada de browser do Web Push (spec 0022).
 *
 * Só fala com as APIs do navegador: registrar o Service Worker, ler e pedir
 * permissão, criar e cancelar a inscrição. Não conhece oRPC, React nem caso de
 * uso nenhum — quem liga isso ao backend é o hook em
 * `src/features/notifications/hooks/use-web-push.ts`.
 */

export type PushAvailability =
  | "ready"
  | "unsupported"
  | "insecure-context"
  | "no-vapid-key";

export type PushPermission = "default" | "granted" | "denied";

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
}

const SERVICE_WORKER_URL = "/sw.js";

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

/**
 * Por que checar `isSecureContext` e não o protocolo: `http://localhost` é
 * contexto seguro por definição da spec, então dev funciona sem HTTPS — mas um
 * deploy em HTTP simples não (CB-13, RNF-3).
 */
export function checkPushAvailability(): PushAvailability {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (!window.isSecureContext) return "insecure-context";
  if (!getVapidPublicKey()) return "no-vapid-key";
  return "ready";
}

export function getPushPermission(): PushPermission {
  if (typeof Notification === "undefined") return "default";
  return Notification.permission as PushPermission;
}

/**
 * `updateViaCache: "none"` impede o browser de servir um SW velho de cache
 * HTTP — sem isso uma correção no `sw.js` pode demorar horas para valer (CB-12).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, {
    scope: "/",
    updateViaCache: "none",
  });
}

/**
 * Pede permissão. Quando já está `denied` não chama de novo: o browser não
 * reexibe o diálogo e a chamada só devolve `denied` outra vez (CB-2).
 */
export async function requestPushPermission(): Promise<PushPermission> {
  const current = getPushPermission();
  if (current !== "default") return current;
  return (await Notification.requestPermission()) as PushPermission;
}

/**
 * Inscrição existente deste browser, se houver.
 *
 * Usa `getRegistration()` e NÃO `navigator.serviceWorker.ready`: `.ready` só
 * resolve quando já existe um worker ativo e fica pendurada para sempre quando
 * não há nenhum registrado — o que trava quem chama antes do primeiro opt-in.
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (checkPushAvailability() !== "ready") return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Garante uma inscrição e devolve o payload que o backend grava.
 * Reaproveita a existente quando já há uma para a mesma chave.
 */
export async function createSubscription(): Promise<PushSubscriptionPayload> {
  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    throw new Error("Chave VAPID pública não configurada.");
  }

  const registration = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      // Obrigatório nos browsers atuais: todo push tem que virar algo visível.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  return toPayload(subscription);
}

/** Cancela no browser. Apagar do banco é responsabilidade de quem chama. */
export async function removeSubscription(): Promise<string | null> {
  const subscription = await getExistingSubscription();
  if (!subscription) return null;

  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}

function toPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const raw = subscription.toJSON();
  const p256dh = raw.keys?.p256dh;
  const auth = raw.keys?.auth;
  if (!p256dh || !auth) {
    throw new Error("Inscrição sem chaves de criptografia.");
  }

  return {
    endpoint: subscription.endpoint,
    keys: { p256dh, auth },
    userAgent:
      typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 400),
  };
}

/**
 * A chave VAPID viaja em base64url; `pushManager.subscribe` exige bytes.
 *
 * O buffer é criado explicitamente porque `applicationServerKey` só aceita
 * `Uint8Array<ArrayBuffer>` — `new Uint8Array(n)` infere `ArrayBufferLike`,
 * que abrange `SharedArrayBuffer` e não passa na assinatura.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
