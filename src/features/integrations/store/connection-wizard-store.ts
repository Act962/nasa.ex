import { create } from "zustand";

export type WizardProvider = "meta" | "google";
export type WizardStep = "welcome" | "authorize" | "select" | "confirm";

type SelectedAccounts = {
  adAccountIds: string[];
  pageIds: string[];
  igAccountIds: string[];
  googleCustomerIds: string[];
};

interface ConnectionWizardState {
  open: boolean;
  provider: WizardProvider | null;
  currentStep: WizardStep;
  oauthSessionId: string | null;
  error: string | null;
  selected: SelectedAccounts;
  isFinalizing: boolean;

  start: (provider: WizardProvider, options?: { returnUrl?: string }) => void;
  setStep: (step: WizardStep) => void;
  next: () => void;
  prev: () => void;
  setOauthSessionId: (id: string | null) => void;
  setError: (error: string | null) => void;
  toggleAdAccount: (id: string) => void;
  togglePage: (id: string) => void;
  toggleIgAccount: (id: string) => void;
  toggleGoogleCustomer: (id: string) => void;
  setSelectedAdAccounts: (ids: string[]) => void;
  setSelectedPages: (ids: string[]) => void;
  setSelectedIgAccounts: (ids: string[]) => void;
  setSelectedGoogleCustomers: (ids: string[]) => void;
  setFinalizing: (v: boolean) => void;
  cancel: () => void;
  finish: () => void;
}

const STEP_ORDER: WizardStep[] = ["welcome", "authorize", "select", "confirm"];

const emptySelected: SelectedAccounts = {
  adAccountIds: [],
  pageIds: [],
  igAccountIds: [],
  googleCustomerIds: [],
};

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

export const useConnectionWizardStore = create<ConnectionWizardState>((set, get) => ({
  open: false,
  provider: null,
  currentStep: "welcome",
  oauthSessionId: null,
  error: null,
  selected: emptySelected,
  isFinalizing: false,

  start: (provider, options) => {
    if (typeof window !== "undefined" && options?.returnUrl) {
      try {
        sessionStorage.setItem("nasa_oauth_return_url", options.returnUrl);
      } catch {
        // ignore
      }
    }
    set({
      open: true,
      provider,
      currentStep: "welcome",
      oauthSessionId: null,
      error: null,
      selected: emptySelected,
      isFinalizing: false,
    });
  },
  setStep: (currentStep) => set({ currentStep }),
  next: () => {
    const { currentStep } = get();
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) set({ currentStep: STEP_ORDER[idx + 1] });
  },
  prev: () => {
    const { currentStep } = get();
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) set({ currentStep: STEP_ORDER[idx - 1] });
  },
  setOauthSessionId: (oauthSessionId) => set({ oauthSessionId }),
  setError: (error) => set({ error }),
  toggleAdAccount: (id) =>
    set((s) => ({ selected: { ...s.selected, adAccountIds: toggle(s.selected.adAccountIds, id) } })),
  togglePage: (id) =>
    set((s) => ({ selected: { ...s.selected, pageIds: toggle(s.selected.pageIds, id) } })),
  toggleIgAccount: (id) =>
    set((s) => ({ selected: { ...s.selected, igAccountIds: toggle(s.selected.igAccountIds, id) } })),
  toggleGoogleCustomer: (id) =>
    set((s) => ({
      selected: { ...s.selected, googleCustomerIds: toggle(s.selected.googleCustomerIds, id) },
    })),
  setSelectedAdAccounts: (adAccountIds) =>
    set((s) => ({ selected: { ...s.selected, adAccountIds } })),
  setSelectedPages: (pageIds) => set((s) => ({ selected: { ...s.selected, pageIds } })),
  setSelectedIgAccounts: (igAccountIds) =>
    set((s) => ({ selected: { ...s.selected, igAccountIds } })),
  setSelectedGoogleCustomers: (googleCustomerIds) =>
    set((s) => ({ selected: { ...s.selected, googleCustomerIds } })),
  setFinalizing: (isFinalizing) => set({ isFinalizing }),
  cancel: () =>
    set({
      open: false,
      provider: null,
      currentStep: "welcome",
      oauthSessionId: null,
      error: null,
      selected: emptySelected,
      isFinalizing: false,
    }),
  finish: () =>
    set({
      open: false,
      provider: null,
      currentStep: "welcome",
      oauthSessionId: null,
      error: null,
      selected: emptySelected,
      isFinalizing: false,
    }),
}));
