import { DEFAULT_TRACKING_DESCRIPTION } from "./default-org-template";

// Identifica o tracking e o lead de exemplo para o destaque "Clique aqui" (spec 0043). Seguro no client.

export const SAMPLE_LEAD_NAME = "Maria (cliente exemplo)";
export const START_HERE_TRACKING_NAME = "Atendimento";

export function isStartHereTracking(tracking: { name: string; description?: string | null }) {
  return tracking.name === START_HERE_TRACKING_NAME && tracking.description === DEFAULT_TRACKING_DESCRIPTION;
}

export function isSampleLead(lead: { name: string }) {
  return lead.name === SAMPLE_LEAD_NAME;
}

const DISMISS_KEY_PREFIX = "orbita:start-here:";

export function isStartHereDismissed(scope: "tracking" | "lead", id: string) {
  try {
    return window.localStorage.getItem(`${DISMISS_KEY_PREFIX}${scope}:${id}`) === "1";
  } catch {
    return false;
  }
}

export function dismissStartHere(scope: "tracking" | "lead", id: string) {
  try {
    window.localStorage.setItem(`${DISMISS_KEY_PREFIX}${scope}:${id}`, "1");
  } catch {
    // sem storage (aba anônima): o destaque volta no próximo acesso, sem prejuízo
  }
}
