// Cartão "escolha a IA do ASTRO" (spec 0053, RF-4).

export interface AstroChooseAiPayload {
  kind: "astro_choose_ai";
  platformModelLabel: string;
  /** Pergunta que esbarrou na falta de IA — reenviada depois da escolha. */
  retryText: string;
}

export function isAstroChooseAiPayload(value: unknown): value is AstroChooseAiPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "astro_choose_ai"
  );
}
