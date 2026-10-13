import type { AiKeySource } from "./describe-ai-resource";

// Estado do selo de IA nos Apps (spec 0093, RF-11). "Chave com problema" fica para depois: hoje nada
// registra quando a chave da empresa falha.

export type AiBadgeState = "own" | "platform" | "off";

export function aiBadgeStateOf(keySource: AiKeySource): AiBadgeState {
  if (keySource === "company" || keySource === "funnel" || keySource === "planner") return "own";
  return keySource === "none" ? "off" : "platform";
}
