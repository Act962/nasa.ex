import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { resolvePrimaryModel } from "@/features/ia/lib/router";
import { isValidCron, describeCron, computeNextRun } from "@/features/astro-commander/lib/cron";
import { PERSONA_LIST } from "@/features/astro-commander/lib/personas";

/**
 * Frase do usuário → rascunho de comando (spec 0023, RF-1).
 *
 * O rascunho não é salvo: ele volta como card de revisão. Salvar o que o
 * modelo entendeu sem alguém olhar seria criar automação que ninguém aprovou.
 */

export const commandDraftSchema = z.object({
  title: z.string().min(3).max(80),
  persona: z.enum(["SALES", "FINANCE", "ADMIN", "ACCOUNTING", "CUSTOM"]),
  triggerType: z.enum(["ONCE", "SCHEDULE", "EVENT"]),
  cron: z.string().nullable(),
  eventKey: z
    .enum(["lead.created", "chat.message.received", "bank.statement.imported"])
    .nullable(),
  autonomy: z.enum(["DRAFT", "APPROVE_ABOVE", "AUTO"]),
  summary: z.string().max(400),
});

export type CommandDraft = z.infer<typeof commandDraftSchema>;

export interface ParsedCommandDraft extends CommandDraft {
  instruction: string;
  /** Texto do gatilho para o card de revisão ("Todo dia às 08:00"). */
  triggerLabel: string;
  nextRunAt: string | null;
  timezone: string;
}

const PERSONA_HINTS = PERSONA_LIST.map(
  (persona) => `- ${persona.key}: ${persona.description}`,
).join("\n");

const SYSTEM_PROMPT = `Você transforma uma ordem em português num comando estruturado do ASTRO.

PERSONAS:
${PERSONA_HINTS}

GATILHOS:
- SCHEDULE: a frase tem periodicidade ("todo dia às 8h", "toda segunda", "a cada 15 minutos"). Preencha "cron" com 5 campos (minuto hora dia mês dia-da-semana). Nunca use 6 campos.
- EVENT: a frase reage a algo que acontece ("quando entrar lead novo", "sempre que chegar mensagem", "quando importar extrato"). Preencha "eventKey".
- ONCE: qualquer outro caso.

AUTONOMIA:
- Use DRAFT (o padrão) sempre que a tarefa envolver dinheiro, proposta ou mensagem para cliente.
- Só use AUTO se a frase disser explicitamente que é para executar sozinho, sem aprovação.

REGRAS:
- "title": nome curto e direto, em português, sem aspas.
- "summary": uma frase dizendo o que o comando vai fazer.
- Preencha com null o campo que não se aplica ao gatilho escolhido.`;

export async function parseCommandInstruction(params: {
  organizationId: string;
  instruction: string;
  timezone?: string;
}): Promise<ParsedCommandDraft> {
  const timezone = params.timezone ?? "America/Sao_Paulo";
  const resolved = await resolvePrimaryModel({
    organizationId: params.organizationId,
    tier: "SMART",
    requires: { json: true },
  });

  const { object } = await generateObject({
    model: resolved.model,
    schema: commandDraftSchema,
    system: SYSTEM_PROMPT,
    prompt: params.instruction,
  });

  return normalizeDraft(object, params.instruction, timezone);
}

/**
 * Conserta o que o modelo pode errar: cron inválido vira `ONCE`, gatilho sem o
 * campo obrigatório também. Melhor um rascunho honesto que o usuário ajusta do
 * que um agendamento que nunca dispara.
 */
export function normalizeDraft(
  draft: CommandDraft,
  instruction: string,
  timezone: string,
): ParsedCommandDraft {
  let triggerType = draft.triggerType;
  let cron = draft.cron;
  let eventKey = draft.eventKey;

  if (triggerType === "SCHEDULE" && (!cron || !isValidCron(cron))) {
    triggerType = "ONCE";
    cron = null;
  }
  if (triggerType === "EVENT" && !eventKey) {
    triggerType = "ONCE";
  }
  if (triggerType !== "SCHEDULE") cron = null;
  if (triggerType !== "EVENT") eventKey = null;

  const nextRunAt =
    triggerType === "SCHEDULE" && cron ? computeNextRun(cron, timezone) : null;

  return {
    ...draft,
    triggerType,
    cron,
    eventKey,
    instruction,
    timezone,
    triggerLabel: describeTrigger(triggerType, cron, eventKey),
    nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
  };
}

const EVENT_LABELS: Record<string, string> = {
  "lead.created": "Quando entrar um lead novo",
  "chat.message.received": "Quando chegar mensagem no chat",
  "bank.statement.imported": "Quando importar extrato bancário",
};

export function describeTrigger(
  triggerType: CommandDraft["triggerType"],
  cron: string | null,
  eventKey: string | null,
): string {
  if (triggerType === "SCHEDULE" && cron) return describeCron(cron);
  if (triggerType === "EVENT" && eventKey) {
    return EVENT_LABELS[eventKey] ?? eventKey;
  }
  return "Execução única";
}
