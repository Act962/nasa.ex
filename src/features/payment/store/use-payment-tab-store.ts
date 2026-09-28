import { create } from "zustand";

/**
 * Aba aberta no /payment.
 *
 * Existe como store (e não só como estado local da página) porque o contexto
 * de rota do Astro precisa saber em que aba o usuário está para responder
 * sobre o que está na tela — e o provider do Astro é montado no layout, longe
 * da página. Ler `useSearchParams` lá obrigaria um Suspense em toda rota da
 * plataforma (spec 0014).
 */
interface PaymentTabState {
  activeTab: string | null;
  setActiveTab: (tab: string | null) => void;
}

export const usePaymentTabStore = create<PaymentTabState>((set) => ({
  activeTab: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
