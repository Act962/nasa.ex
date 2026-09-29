"use client";

import { create } from "zustand";
import type { AstroVoicePriority } from "@/features/astro/lib/astro-voice-catalog";

/**
 * Balão de fala do ASTRO acima do orb (spec 0029, RF-10).
 *
 * Mistura o que ele está fazendo ("Respondendo…", "Executando comando") com o
 * que ele está avisando ("Boleto vencendo hoje"). Três itens no máximo: mais
 * que isso vira parede de texto em cima da tela do usuário.
 */

export type AstroFeedKind = "activity" | "alert";

export interface AstroFeedItem {
  id: string;
  kind: AstroFeedKind;
  headline: string;
  detail?: string;
  priority: AstroVoicePriority;
  /** Aba do widget aberta no clique; padrão é Início. */
  openView?: "home" | "chat";
  createdAt: number;
}

const MAX_VISIBLE_ITEMS = 3;

interface AstroFeedStore {
  items: AstroFeedItem[];
  /**
   * Mostra um item. Mesmo `id` substitui o anterior (ex.: a atividade de um
   * comando passa de "executando" para "concluído"). `ttlMs` omitido = fica até
   * alguém remover — usado por atividades que duram (resposta em andamento).
   */
  push: (item: Omit<AstroFeedItem, "createdAt">, ttlMs?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useAstroFeedStore = create<AstroFeedStore>()((set, get) => ({
  items: [],

  push: (item, ttlMs) => {
    // Aviso igual a um que já está na fila não entra de novo: três notificações
    // de Stars com a mesma fala viravam três balões idênticos.
    const duplicate = get().items.find(
      (current) =>
        current.id !== item.id &&
        current.headline === item.headline &&
        current.detail === item.detail,
    );
    const itemId = duplicate?.id ?? item.id;

    const existingTimer = expiryTimers.get(itemId);
    if (existingTimer) clearTimeout(existingTimer);

    set((state) => {
      const others = state.items.filter((current) => current.id !== itemId);
      const next = [...others, { ...item, id: itemId, createdAt: Date.now() }];
      // Estourou o limite: sai o mais antigo, alerta urgente fica por último.
      while (next.length > MAX_VISIBLE_ITEMS) {
        const removableIndex = next.findIndex((current) => current.priority !== "urgent");
        next.splice(removableIndex === -1 ? 0 : removableIndex, 1);
      }
      return { items: next };
    });

    if (ttlMs) {
      expiryTimers.set(
        itemId,
        setTimeout(() => get().remove(itemId), ttlMs),
      );
    }
  },

  remove: (id) => {
    const timer = expiryTimers.get(id);
    if (timer) clearTimeout(timer);
    expiryTimers.delete(id);
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },

  clear: () => {
    for (const timer of expiryTimers.values()) clearTimeout(timer);
    expiryTimers.clear();
    set({ items: [] });
  },
}));
