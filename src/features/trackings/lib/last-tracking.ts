import { atomWithStorage } from "jotai/utils";

// Último funil que a pessoa abriu, guardado no navegador dela. Serve de atalho: a central de Gatilhos
// Automáticos abre os fluxos desse funil sem perguntar qual.
export const lastTrackingIdAtom = atomWithStorage<string | null>("orbita:last-tracking-id", null);
