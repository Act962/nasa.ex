import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { resolvePrimaryModel } from "@/features/ia/lib/router";
import { ASTRO_ACTIONS } from "./registry";

// Classificador de intenção (spec 0023, RF-3). Roda ANTES do orquestrador e
// existe por um motivo medido: o orquestrador manda 91 definições de
// ferramenta em todo turno, ~18.500 tokens, mesmo para "quais meus trackings".
// Aqui vai só a lista de ações e a frase do usuário — centenas de tokens.

/** Acima disto a ação executa direto; abaixo, o orquestrador assume (RF-4/RF-5). */
export const CONFIDENCE_THRESHOLD = 0.75;

/**
 * Passado este tempo compensa mais ir ao orquestrador do que esperar os dois
 * (RNF-2). Medido em 2026-09-24: 1.500 ms derrubava 100% das classificações
 * antes de qualquer resposta — `generateObject` no nível FAST não fecha nesse
 * prazo. Ver changelog da spec 0023.
 */
const CLASSIFIER_TIMEOUT_MS = 4000;

const classificationSchema = z.object({
  action: z
    .string()
    .nullable()
    .describe("Chave da ação, ou null quando nenhuma serve ou o pedido é complexo."),
  // Pares em vez de `z.record`: o structured output da OpenAI recusa o
  // `propertyNames` que o record gera ("'propertyNames' is not permitted").
  fields: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .describe("Campos extraídos da frase. Só o que foi dito — nunca invente."),
  confidence: z.number().min(0).max(1),
});

type RawClassification = z.infer<typeof classificationSchema>;

export interface AstroIntentClassification {
  action: string;
  fields: Record<string, string>;
  confidence: number;
  /** Uso real desta volta — é o número que prova a economia (CA-2). */
  tokensUsed: number;
  provider: string;
  modelId: string;
}

function toFieldRecord(pairs: RawClassification["fields"]): Record<string, string> {
  return Object.fromEntries(pairs.map((pair) => [pair.key, pair.value]));
}

function buildCatalog(): string {
  return ASTRO_ACTIONS.map((action) => {
    const shape = action.input instanceof z.ZodObject ? action.input.shape : {};
    const fields = Object.keys(shape).join(", ") || "—";
    return `- ${action.key}: ${action.description}\n  campos: ${fields}`;
  }).join("\n");
}

const SYSTEM_PROMPT = `Você classifica pedidos de usuários de um CRM em ações.

Devolva a chave da ação quando o pedido for uma ação direta e clara.
Devolva action=null quando:
- o pedido envolver comparação, análise, várias fontes de dado ou pesquisa;
- houver mais de uma intenção na mesma frase;
- nenhuma ação da lista servir.

Extraia em "fields" apenas o que a frase disse. Não complete, não adivinhe,
não use conhecimento externo. Campo não dito simplesmente não aparece.

"confidence" é o quanto você tem certeza da ação escolhida, não dos campos.`;

/**
 * Devolve a ação escolhida, ou `null` sempre que houver qualquer dúvida ou
 * falha. Nunca lança: erro de provedor, timeout e JSON inválido caem todos no
 * mesmo lugar, que é deixar o orquestrador atender (RNF-3).
 */
export async function classifyAstroIntent(params: {
  organizationId: string;
  text: string;
}): Promise<AstroIntentClassification | null> {
  if (ASTRO_ACTIONS.length === 0) return null;

  try {
    const resolved = await resolvePrimaryModel({
      organizationId: params.organizationId,
      tier: "FAST",
    });

    const startedAt = Date.now();
    const classification = await Promise.race([
      generateObject({
        model: resolved.model,
        schema: classificationSchema,
        system: `${SYSTEM_PROMPT}\n\nAções disponíveis:\n${buildCatalog()}`,
        prompt: params.text,
      }).then((result) => ({
        object: result.object,
        tokensUsed: result.usage?.totalTokens ?? 0,
      })),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), CLASSIFIER_TIMEOUT_MS),
      ),
    ]);

    if (!classification) {
      console.log("[astro/classifier] sem resposta no prazo — orquestrador");
      return null;
    }
    const { object: decision, tokensUsed } = classification;
    console.log(
      `[astro/classifier] action=${decision.action} confiança=${decision.confidence} ` +
        `campos=[${decision.fields.map((pair) => pair.key).join(",")}] ` +
        `em ${Date.now() - startedAt}ms`,
    );
    if (!decision.action) return null;
    if (decision.confidence < CONFIDENCE_THRESHOLD) return null;
    // Modelo pode devolver chave que não existe; tratamos como "não sei".
    if (!ASTRO_ACTIONS.some((action) => action.key === decision.action)) {
      return null;
    }
    return {
      action: decision.action,
      fields: toFieldRecord(decision.fields),
      confidence: decision.confidence,
      tokensUsed,
      provider: resolved.provider,
      modelId: resolved.modelId,
    };
  } catch (error) {
    // Loga a causa, nunca a frase: o texto do usuário não vai para o log (RNF-3).
    console.warn(
      "[astro/classifier] falhou — seguindo para o orquestrador:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
