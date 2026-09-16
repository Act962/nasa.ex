"use client";

import { create } from "zustand";

/**
 * Estado do painel de chat do Astro aberto pelo orb (spec 0015).
 *
 * Não é persistido: a conversa em si sobrevive a refresh pelo `sessionStorage`
 * (ver `use-astro-widget-session`), mas aberto/fechado é estado da tela.
 */

export interface AstroWidgetPrompt {
  text: string;
  /** Veio da voz — decide se a resposta é narrada. */
  fromVoice: boolean;
}

interface AstroWidgetStore {
  isOpen: boolean;
  /**
   * Já foi aberto nesta aba. A partir daí o chat fica montado mesmo fechado,
   * para um stream em andamento não morrer quando o usuário fecha o painel.
   */
  hasOpened: boolean;
  /** Respostas que chegaram com o painel fechado. */
  unreadCount: number;
  /** Texto a enviar assim que a conversa estiver pronta (sugestão, voz, evento). */
  pendingPrompt: AstroWidgetPrompt | null;

  open: (prompt?: AstroWidgetPrompt) => void;
  close: () => void;
  toggle: () => void;
  consumePendingPrompt: () => AstroWidgetPrompt | null;
  incrementUnread: () => void;
}

export const useAstroWidgetStore = create<AstroWidgetStore>()((set, get) => ({
  isOpen: false,
  hasOpened: false,
  unreadCount: 0,
  pendingPrompt: null,

  open: (prompt) =>
    set((state) => ({
      isOpen: true,
      hasOpened: true,
      unreadCount: 0,
      pendingPrompt: prompt ?? state.pendingPrompt,
    })),
  close: () => set({ isOpen: false }),
  toggle: () => {
    if (get().isOpen) get().close();
    else get().open();
  },
  consumePendingPrompt: () => {
    const prompt = get().pendingPrompt;
    if (prompt) set({ pendingPrompt: null });
    return prompt;
  },
  incrementUnread: () =>
    set((state) => (state.isOpen ? state : { unreadCount: state.unreadCount + 1 })),
}));
