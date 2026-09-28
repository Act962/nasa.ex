"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

/**
 * Sessão do painel de chat do Astro (spec 0015). O id fica no `sessionStorage`
 * — a conversa pertence à aba, sobrevive a refresh e não se mistura com a do
 * /home, que é escolhida no histórico.
 */

export const ASTRO_WIDGET_SESSION_STORAGE_KEY = "astro-widget-session";
/**
 * A tela cheia tem chave própria: o painel e o /home são conversas
 * diferentes, e misturá-las faria o refresh de uma trocar a outra.
 */
export const ASTRO_COMMAND_SESSION_STORAGE_KEY = "astro-command-session";

function readStored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, sessionId: string | null) {
  try {
    if (sessionId) window.sessionStorage.setItem(key, sessionId);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Sem storage, a conversa só não é restaurada no refresh.
  }
}

export function readStoredCommandSessionId(): string | null {
  return readStored(ASTRO_COMMAND_SESSION_STORAGE_KEY);
}

export function storeCommandSessionId(sessionId: string | null) {
  writeStored(ASTRO_COMMAND_SESSION_STORAGE_KEY, sessionId);
}

export function readStoredWidgetSessionId(): string | null {
  try {
    return window.sessionStorage.getItem(ASTRO_WIDGET_SESSION_STORAGE_KEY);
  } catch {
    // Storage bloqueado (aba privada, política do navegador): começa do zero.
    return null;
  }
}

export function storeWidgetSessionId(sessionId: string | null) {
  try {
    if (sessionId) {
      window.sessionStorage.setItem(ASTRO_WIDGET_SESSION_STORAGE_KEY, sessionId);
    } else {
      window.sessionStorage.removeItem(ASTRO_WIDGET_SESSION_STORAGE_KEY);
    }
  } catch {
    // Sem storage, a conversa só não é restaurada no refresh.
  }
}

/** Mensagens da sessão salva. Falha (apagada, de outro usuário) vira painel vazio. */
export function useAstroWidgetStoredSession(sessionId: string | null) {
  return useQuery({
    ...orpc.astro.sessions.get.queryOptions({ input: { id: sessionId ?? "" } }),
    enabled: Boolean(sessionId),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
}
