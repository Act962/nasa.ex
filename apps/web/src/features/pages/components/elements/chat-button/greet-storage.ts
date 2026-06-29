/**
 * Persistência do auto-greet via localStorage. Controla se a abordagem
 * inicial ("Oi, se precisar estou aqui") já foi mostrada nas últimas 24h,
 * evitando bombardear o cliente a cada reload da sessão. Todas as funções
 * são no-op fora do browser (SSR-safe) e toleram falha de quota/modo
 * privado silenciosamente.
 */

const GREET_STORAGE_KEY = "nasa_chatbot_greeted_at";
const GREET_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

export function shouldAutoGreet(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lastGreetedAt = Number(
      window.localStorage.getItem(GREET_STORAGE_KEY) ?? 0,
    );
    if (!lastGreetedAt) return true;
    return Date.now() - lastGreetedAt > GREET_COOLDOWN_MS;
  } catch {
    return true;
  }
}

export function markGreeted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GREET_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore (private mode, quota etc)
  }
}
