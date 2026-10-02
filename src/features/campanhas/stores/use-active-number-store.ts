import { create } from "zustand";

/** Número oficial escolhido no app Campanhas — o topo (saldo) e o painel do número seguem o mesmo. */
interface ActiveNumberState {
  selectedTrackingId: string | null;
  selectTrackingId: (trackingId: string) => void;
}

export const useActiveNumberStore = create<ActiveNumberState>((set) => ({
  selectedTrackingId: null,
  selectTrackingId: (trackingId) => set({ selectedTrackingId: trackingId }),
}));
