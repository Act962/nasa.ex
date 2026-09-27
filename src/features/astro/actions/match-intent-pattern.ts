import "server-only";
import { ASTRO_ACTIONS } from "./registry";
import type { StagedClassification } from "./classify-staged";

// Camada zero do roteamento (spec 0033, RF-9): frase inequívoca vai direto
// para o roteiro do verbo, sem classificador nem orquestrador.

function normalizeIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function matchIntentPattern(text: string): StagedClassification | null {
  const normalized = normalizeIntentText(text);
  const matchedActions = ASTRO_ACTIONS.filter((action) =>
    (action.intentPatterns ?? []).some((pattern) => pattern.test(normalized)),
  );
  // Dois verbos casando é dúvida de verdade: aí o classificador decide.
  if (matchedActions.length !== 1) return null;
  const [action] = matchedActions;
  return {
    app: action.app,
    candidates: [{ action: action.key, confidence: 1, fields: {} }],
    layer: "pattern",
    tokensUsed: 0,
    provider: "codigo",
    modelId: "padrao-de-frase",
  };
}

/** Algum verbo casou? Frase de ação nunca é consulta, mesmo com dois verbos. */
export function matchesAnyIntentPattern(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return ASTRO_ACTIONS.some((action) =>
    (action.intentPatterns ?? []).some((pattern) => pattern.test(normalized)),
  );
}
