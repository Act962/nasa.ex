import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado da sessão de chat Astro com contexto de Meta Ads.
 *
 * Cada sessão tem uma `activeCampaign` opcional — campanha em foco no chat.
 * Tools de gestão (pausar, editar, criar ad) só rodam quando há
 * activeCampaign setada. Tools agnósticas (overview, listar) ignoram.
 *
 * Persistido em sessionStorage pra manter contexto entre re-renders /
 * navegações dentro da mesma sessão. Reset ao fechar aba.
 */

export type AstroActiveCampaign = {
  metaCampaignId: string;
  name: string;
  status?: string;
  dailyBudgetReais?: number;
};

type AstroMetaContextState = {
  activeCampaign: AstroActiveCampaign | null;
  /**
   * "all" = explicitamente trabalhando com TODAS as campanhas (não exigir
   * picker). null = ainda não escolheu.
   */
  scope: "single" | "all" | null;
  setActiveCampaign: (camp: AstroActiveCampaign) => void;
  setScopeAll: () => void;
  clear: () => void;
};

export const useAstroMetaContext = create<AstroMetaContextState>()(
  persist(
    (set) => ({
      activeCampaign: null,
      scope: null,
      setActiveCampaign: (camp) => set({ activeCampaign: camp, scope: "single" }),
      setScopeAll: () => set({ activeCampaign: null, scope: "all" }),
      clear: () => set({ activeCampaign: null, scope: null }),
    }),
    {
      name: "astro-meta-context",
      // sessionStorage = limpa ao fechar aba (não polui localStorage)
      storage: typeof window !== "undefined"
        ? {
            getItem: (key) => {
              const v = sessionStorage.getItem(key);
              return v ? JSON.parse(v) : null;
            },
            setItem: (key, value) =>
              sessionStorage.setItem(key, JSON.stringify(value)),
            removeItem: (key) => sessionStorage.removeItem(key),
          }
        : undefined,
    },
  ),
);
