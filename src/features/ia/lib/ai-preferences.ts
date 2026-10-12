import { z } from "zod";
import { AI_RESOURCE_BY_ID } from "./ai-resources";
import type { ModelBand } from "./ai-model-guide";

// Preferências de IA da empresa (spec 0093, etapa 2, RF-15): em quais recursos a chave própria vale e
// a faixa do modelo por uso. Vazio é o padrão e significa "tudo como sempre foi". Puro: sem banco.

/** Recursos já ligados ao seletor único: só neles a preferência tem efeito (RF-18). */
export const SELECTOR_WIRED_RESOURCE_IDS = new Set([
  "chat.assist",
  "tracking.assistant",
  "workspace.assistant",
  "comments.reply",
  "workflows.quick-builder",
  "astro.build-flow",
  "insights.narrative",
  "workflows.ai-steps",
]);

/** Usos em que a faixa do modelo pode ser escolhida nesta fatia, e o recurso que ela governa (RF-19). */
export const BAND_USE_RESOURCE_ID = { flows: "workflows.ai-steps" } as const;
export type AiBandUse = keyof typeof BAND_USE_RESOURCE_ID;

const MODEL_BANDS = ["economico", "equilibrado", "inteligente"] as const satisfies readonly ModelBand[];

export interface AiPreferences {
  /** Recursos em que a pessoa ligou a chave da empresa e que, sem isso, usariam só a da plataforma. */
  companyKeyResources: string[];
  useBands: Partial<Record<AiBandUse, ModelBand>>;
}

export const EMPTY_AI_PREFERENCES: AiPreferences = { companyKeyResources: [], useBands: {} };

const storedPreferencesSchema = z.object({
  companyKeyResources: z.array(z.string()).catch([]),
  useBands: z.object({ flows: z.enum(MODEL_BANDS).optional() }).catch({}),
});

/** Lê o JSON guardado. Qualquer coisa fora do formato vira o padrão vazio, nunca um erro. */
export function parseAiPreferences(stored: unknown): AiPreferences {
  const parsed = storedPreferencesSchema.safeParse(stored ?? {});
  if (!parsed.success) return EMPTY_AI_PREFERENCES;
  return {
    companyKeyResources: parsed.data.companyKeyResources.filter((resourceId) => SELECTOR_WIRED_RESOURCE_IDS.has(resourceId)),
    useBands: parsed.data.useBands,
  };
}

/** O que a rota aceita gravar: só recurso do cadastro que já está ligado ao seletor. */
export const aiPreferencesInputSchema = z.object({
  companyKeyResources: z
    .array(z.string().max(80))
    .max(SELECTOR_WIRED_RESOURCE_IDS.size)
    .refine((resourceIds) => resourceIds.every((resourceId) => AI_RESOURCE_BY_ID.has(resourceId) && SELECTOR_WIRED_RESOURCE_IDS.has(resourceId)), {
      message: "Recurso de IA desconhecido ou ainda não disponível para escolha.",
    }),
  useBands: z.object({ flows: z.enum(MODEL_BANDS).optional() }),
});
