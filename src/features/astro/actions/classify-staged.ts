import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { resolvePrimaryModel } from "@/features/ia/lib/router";
import { ASTRO_APPS, type AstroAppId } from "./apps";
import { ASTRO_ACTIONS } from "./registry";
import type { AstroAction } from "./types";

// Triagem em duas etapas (spec 0025).
//
// A lista única não escala: medido, um verbo novo derrubou o vizinho para 1
// acerto em 3, e um parágrafo a mais no prompt derrubou outro de 3/3 para 0/3.
// Aqui nenhuma etapa vê mais de ~15 opções, independente do catálogo total.

/** Acima disto executa direto. */
export const HIGH_CONFIDENCE = 0.8;
/** Entre este e o alto, pergunta ao usuário em vez de chutar (RF-4). */
export const LOW_CONFIDENCE = 0.45;

const STAGE_TIMEOUT_MS = 4000;

const appSchema = z.object({
  app: z.string().nullable().describe("Chave do app, ou null se nenhum servir."),
  confidence: z.number().min(0).max(1),
});

const verbSchema = z.object({
  candidates: z
    .array(
      z.object({
        action: z.string(),
        confidence: z.number().min(0).max(1),
        fields: z.array(z.object({ key: z.string(), value: z.string() })),
      }),
    )
    .describe("Até 3 ações possíveis, da mais provável para a menos."),
});

export type StagedLayer = "stage1" | "stage2" | "dropdown" | "smart" | "orchestrator";

export interface StagedCandidate {
  action: string;
  confidence: number;
  fields: Record<string, string>;
}

export interface StagedClassification {
  app: AstroAppId;
  /** Ordenados por confiança. O primeiro é o palpite. */
  candidates: StagedCandidate[];
  layer: StagedLayer;
  tokensUsed: number;
  provider: string;
  modelId: string;
}

function appsWithVerbs(): AstroAppId[] {
  return [...new Set(ASTRO_ACTIONS.map((action) => action.app))];
}

function verbsOf(app: AstroAppId): AstroAction[] {
  return ASTRO_ACTIONS.filter((action) => action.app === app);
}

function shortDescription(description: string): string {
  const [first] = description.split(". ");
  return first.endsWith(".") ? first : `${first}.`;
}

function withTimeout<T>(promise: Promise<T>): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), STAGE_TIMEOUT_MS)),
  ]);
}

const STAGE1_PROMPT = `Você recebe um pedido de usuário de um sistema de gestão
e diz de qual APP ele é. Responda null quando o pedido for análise, comparação,
relatório, ou não pertencer claramente a nenhum app.`;

const STAGE2_PROMPT = `Você recebe um pedido e a lista de ações de um app.
Devolva até 3 ações possíveis, ordenadas da mais para a menos provável, cada
uma com os campos que a frase disse.

Extraia apenas o que foi dito. Campo não dito não aparece. Booleano vai como
"true" ou "false". Campo opcional que a frase não disse: OMITA — nunca mande
string vazia.

REFERÊNCIA — "ele", "ela", "esse", "o mesmo", "a última":

Havendo conversa anterior, procure nela o NOME PRÓPRIO e use esse nome:
  Conversa: "Astro: Entrou 1 lead no tracking VENDAS: Ana Paula."
  Pedido:   "manda uma proposta para ela"
  Correto:  fields = [{key:"clientName", value:"Ana Paula"}]
  Errado:   fields = [] ou value = "ela"

Sem conversa anterior, o campo fica AUSENTE. Pronome nunca é valor:
  Conversa: (nenhuma)
  Pedido:   "crie uma proposta para ele"
  Correto:  fields = []
  Errado:   fields = [{key:"clientName", value:"ele"}]`;

function buildHistoryBlock(history?: string[]): string {
  const recent = (history ?? []).slice(-3).map((line) => line.slice(0, 280).trim());
  if (recent.length === 0) return "";
  return `\n\nConversa até aqui:\n${recent.map((line) => `- ${line}`).join("\n")}`;
}

/**
 * Etapa 1 + etapa 2. Devolve `null` quando o pedido não é ação — aí quem
 * atende é o orquestrador, como sempre.
 */
export async function classifyStaged(params: {
  organizationId: string;
  text: string;
  history?: string[];
}): Promise<StagedClassification | null> {
  const apps = appsWithVerbs();
  if (apps.length === 0) return null;

  let tokensUsed = 0;

  try {
    const fast = await resolvePrimaryModel({
      organizationId: params.organizationId,
      tier: "FAST",
    });

    // ── Etapa 1 — de qual app é ─────────────────────────────────────────
    const catalog = apps.map((app) => `- ${app}: ${ASTRO_APPS[app]}`).join("\n");
    const stage1 = await withTimeout(
      generateObject({
        model: fast.model,
        schema: appSchema,
        system: `${STAGE1_PROMPT}\n\nApps:\n${catalog}`,
        prompt: params.text + buildHistoryBlock(params.history),
      }),
    );
    if (!stage1) return null;
    tokensUsed += stage1.usage?.totalTokens ?? 0;

    let chosenApp = stage1.object.app as AstroAppId | null;
    let layer: StagedLayer = "stage1";

    // Dúvida no app sobe de modelo antes de desistir (RF-6): errar o app faz
    // o verbo certo nem ser considerado na etapa 2.
    //
    // Vale também para app NULO. Medido: "renomeia a coluna Início para
    // Entrada" vinha null em 1 de 3 tentativas e o pedido morria aqui, mesmo
    // com a etapa 2 acertando 0,95 quando chegava nela. Tratar null como
    // "não sei" em vez de "não é ação" é o que a RF-6 quer dizer.
    const needsEscalation =
      !chosenApp || stage1.object.confidence < LOW_CONFIDENCE;
    if (needsEscalation) {
      const smart = await resolvePrimaryModel({
        organizationId: params.organizationId,
        tier: "SMART",
      });
      const retry = await withTimeout(
        generateObject({
          model: smart.model,
          schema: appSchema,
          system: `${STAGE1_PROMPT}\n\nApps:\n${catalog}`,
          prompt: params.text + buildHistoryBlock(params.history),
        }),
      );
      if (retry) {
        tokensUsed += retry.usage?.totalTokens ?? 0;
        // Só aceita o resultado do SMART se ele de fato escolheu: um null aqui
        // confirma que não é ação, e aí o orquestrador atende.
        if (retry.object.app) {
          chosenApp = retry.object.app as AstroAppId;
          layer = "smart";
        }
      }
    }

    if (!chosenApp || !apps.includes(chosenApp)) return null;

    // ── Etapa 2 — qual ação dentro do app ───────────────────────────────
    const verbs = verbsOf(chosenApp);
    const verbCatalog = verbs
      .map((action) => {
        const shape = action.input instanceof z.ZodObject ? action.input.shape : {};
        return `- ${action.key}: ${shortDescription(action.description)} [${Object.keys(shape).join(", ")}]`;
      })
      .join("\n");

    const stage2 = await withTimeout(
      generateObject({
        model: fast.model,
        schema: verbSchema,
        system: `${STAGE2_PROMPT}\n\nAções de ${chosenApp}:\n${verbCatalog}`,
        prompt: params.text + buildHistoryBlock(params.history),
      }),
    );
    if (!stage2) return null;
    tokensUsed += stage2.usage?.totalTokens ?? 0;

    const known = new Set(verbs.map((action) => action.key));
    const candidates = stage2.object.candidates
      .filter((candidate) => known.has(candidate.action))
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 3)
      .map((candidate) => ({
        action: candidate.action,
        confidence: candidate.confidence,
        fields: Object.fromEntries(candidate.fields.map((f) => [f.key, f.value])),
      }));

    if (candidates.length === 0) return null;

    return {
      app: chosenApp,
      candidates,
      layer: layer === "smart" ? "smart" : "stage2",
      tokensUsed,
      provider: fast.provider,
      modelId: fast.modelId,
    };
  } catch (error) {
    console.warn(
      "[astro/staged] falhou — seguindo para o orquestrador:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
