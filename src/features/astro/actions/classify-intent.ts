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

/** Quantas falas anteriores entram. Três cobre "ele/ela/isso" sem inchar. */
const HISTORY_TURNS = 3;
/** Corte por fala: o que importa é a referência, não o texto inteiro. */
const HISTORY_CHARS = 280;

function buildPrompt(text: string, history?: string[]): string {
  const recent = (history ?? [])
    .slice(-HISTORY_TURNS)
    .map((line) => line.slice(0, HISTORY_CHARS).trim())
    .filter(Boolean);
  if (recent.length === 0) return text;
  return [
    "Conversa até aqui (a mais recente por último):",
    ...recent.map((line) => `- ${line}`),
    "",
    `Pedido atual: ${text}`,
  ].join("\n");
}

/**
 * Só a primeira frase da descrição entra aqui. A descrição completa existe
 * para o orquestrador, e traz exemplos de fala ("use quando o usuário
 * disser...") que ajudam lá e só incham o catálogo aqui: com 11 verbos o
 * prompt passou de 1.000 tokens, estourando a RNF-1 da spec 0023.
 */
function shortDescription(description: string): string {
  const [first] = description.split(". ");
  return first.endsWith(".") ? first : `${first}.`;
}

function buildCatalog(): string {
  return ASTRO_ACTIONS.map((action) => {
    const shape = action.input instanceof z.ZodObject ? action.input.shape : {};
    const fields = Object.keys(shape).join(", ") || "—";
    return `- ${action.key}: ${shortDescription(action.description)} [${fields}]`;
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

"confidence" é o quanto você tem certeza da ação escolhida, não dos campos.

RESOLUÇÃO DE REFERÊNCIA — leia com atenção:

Quando o pedido usar "ele", "ela", "esse", "o mesmo", "a última", "dele", você
DEVE procurar na conversa anterior o nome próprio a que se refere e colocar
ESSE NOME no campo. Não devolva o pronome, não deixe o campo vazio.

Exemplo:
  Conversa: "Astro: Entrou 1 lead no tracking VENDAS: Ana Paula."
  Pedido:   "manda uma proposta para ela"
  Correto:  fields = [{key:"clientName", value:"Ana Paula"}]
  Errado:   fields = [] ou value = "ela"

Se o pedido trouxer um nome próprio SEU, use esse nome e ignore a conversa —
nem tudo que vem depois se refere ao que veio antes.

Quando NÃO houver conversa anterior, ou quando ela não contiver nome próprio
nenhum, o campo fica AUSENTE. Pronome nunca é valor de campo:

  Conversa: (nenhuma)
  Pedido:   "manda uma proposta para ele"
  Correto:  fields = []
  Errado:   fields = [{key:"clientName", value:"ele"}]`;

/**
 * Devolve a ação escolhida, ou `null` sempre que houver qualquer dúvida ou
 * falha. Nunca lança: erro de provedor, timeout e JSON inválido caem todos no
 * mesmo lugar, que é deixar o orquestrador atender (RNF-3).
 */
export async function classifyAstroIntent(params: {
  organizationId: string;
  text: string;
  /**
   * Últimas falas da conversa, da mais antiga para a mais recente. Sem isto,
   * "crie uma proposta para ele" não tem antecedente e o classificador não
   * resolve o pronome — o pedido acaba escalando por falta de contexto, não
   * por complexidade.
   */
  history?: string[];
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
        prompt: buildPrompt(params.text, params.history),
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
