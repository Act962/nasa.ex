import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { getAstroAction } from "../registry";
import { matchIntentPattern } from "../match-intent-pattern";
import { HIGH_CONFIDENCE, classifyStaged } from "../classify-staged";
import { toStringFields } from "../guided-answers";
import { normalizeClause, splitIntoClauses } from "./split-clauses";

// Da frase ao plano (spec 0033, RF-6): cada trecho vira uma parte com o seu
// verbo, e as regras abaixo ligam uma parte à outra — "ele" é o lead da parte
// anterior, "2 dias antes" é do vencimento lançado antes.

/** D-4: acima disso é mais provável serem dois assuntos do que um plano. */
export const MAX_PLAN_PARTS = 3;

export interface PlanPart {
  actionKey: string;
  clause: string;
  fields: Record<string, string>;
  /** Parte que cria o alvo desta (lead, funil): sem ela, esta não roda. */
  dependsOn?: number;
  /** Lead herdado de outra parte ("com ele", ou sem nome nenhum). */
  leadFrom?: number;
  /** Funil herdado da parte que o cria ("com as etapas A, B e C"). */
  trackingFrom?: number;
  /** Mensagem montada com o resultado de outra parte (link da proposta). */
  messageFrom?: number;
  /** Lembrete N dias antes do vencimento lançado em outra parte. */
  daysBefore?: { from: number; days: number };
  /** Comprovante do lançamento baixado em outra parte. */
  receiptFrom?: number;
  prepared?: boolean;
  ready?: boolean;
  input?: Record<string, unknown>;
  summary?: string;
  /** Parte que não dá para fazer — vai ao cartão com o motivo, nunca some. */
  failure?: string;
}

/** Campo que aponta o lead de cada verbo. */
export const LEAD_FIELD: Record<string, string> = {
  "lead.create": "leadName",
  "lead.move": "leadName",
  "lead.add_note": "leadName",
  "lead.add_tag": "leadName",
  "lead.update": "leadName",
  "lead.toggle_favorite": "leadName",
  "lead.delete": "leadName",
  "appointment.create": "leadName",
  "agenda.reschedule_appointment": "personName",
  "forge.create_proposal": "clientName",
  "chat.send_message": "leadName",
  "chat.send_template": "leadName",
  "form.send_to_lead": "leadName",
};

/** Verbos que apagam ou desfazem: pedem cartão próprio, fora do plano. */
export const DESTRUCTIVE_ACTIONS = new Set([
  "lead.delete",
  "forge.delete_proposal",
  "forge.delete_empty_draft_proposals",
  "forge.cancel_proposal",
  "tracking.archive",
  "agenda.cancel_appointment",
]);

const NUMBER_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5 };

const SELF_NOTICE = /^me\s+(manda|mande|envia|envie|avisa|avise|notifica|notifique)\b.*\b(notificac|aviso|lembrete|whats|zap)/;
const SEND_TO_PRONOUN = /^(manda|mande|envia|envie|avisa|avise)\b.*\b(ela|ele|pra ela|pra ele|no whats|pelo whats|link)\b/;
const DAYS_BEFORE = /\b(\d{1,2}|um|uma|dois|duas|tres|quatro|cinco)\s+dias?\s+antes\b/;
const STAGES_SUFFIX = /\s+com\s+(?:as\s+)?(?:etapas|colunas)\s+(.+)$/iu;

export type PlanDraft =
  | { kind: "plan"; parts: PlanPart[] }
  | { kind: "too_many"; count: number };

async function partForClause(
  ctx: AgentContext,
  clause: string,
  previous: PlanPart | undefined,
  previousIndex: number,
): Promise<PlanPart | "merge"> {
  const normalized = normalizeClause(clause);

  // "e me mande uma notificação no WhatsApp" depois de agendar é o aviso do
  // próprio compromisso — o verbo de agenda já sabe fazê-lo.
  if (previous?.actionKey === "appointment.create" && SELF_NOTICE.test(normalized)) return "merge";
  // "e atribui ao Vendedor" é o responsável da própria tarefa.
  if (previous?.actionKey === "action.create" && /^(atribui|atribua|atribuir)\b/.test(normalized)) return "merge";

  if (previous?.actionKey === "payment.mark_paid" && /\bcomprovante\b/.test(normalized)) {
    return { actionKey: "payment.receipt", clause, fields: {}, receiptFrom: previousIndex };
  }

  const daysBefore = normalized.match(DAYS_BEFORE);
  if (daysBefore && previous?.actionKey === "payment.create_entry" && /\blembr/.test(normalized)) {
    const days = NUMBER_WORDS[daysBefore[1]] ?? Number(daysBefore[1]);
    return {
      actionKey: "agenda.create_reminder",
      clause,
      fields: {},
      daysBefore: { from: previousIndex, days },
    };
  }

  if (/\be-?mail\b/.test(normalized)) {
    return { actionKey: "unsupported", clause, fields: {}, failure: "O ASTRO ainda não envia e-mail." };
  }

  const matched = matchIntentPattern(clause);
  if (matched) {
    const action = getAstroAction(matched.candidates[0].action)!;
    return { actionKey: action.key, clause, fields: toStringFields(action.inferFields?.(clause) ?? {}) };
  }

  if (previous && SEND_TO_PRONOUN.test(normalized)) {
    return { actionKey: "chat.send_message", clause, fields: {}, messageFrom: previousIndex };
  }

  // Trecho sem padrão: aí sim o classificador, só com este pedaço da frase.
  const classified = await classifyStaged({ organizationId: ctx.organizationId, text: clause });
  const best = classified?.candidates[0];
  const action = best && best.confidence >= HIGH_CONFIDENCE ? getAstroAction(best.action) : undefined;
  if (!action || !best) {
    return { actionKey: "unsupported", clause, fields: {}, failure: `Não entendi esta parte: "${clause}".` };
  }
  return {
    actionKey: action.key,
    clause,
    fields: { ...toStringFields(action.inferFields?.(clause) ?? {}), ...toStringFields(best.fields) },
  };
}

/** "Cria o funil Eventos com as etapas A, B e C" → funil + uma parte por etapa. */
function expandStages(part: PlanPart, index: number): PlanPart[] {
  if (part.actionKey !== "tracking.create") return [part];
  const stages = part.clause.match(STAGES_SUFFIX)?.[1];
  if (!stages) return [part];
  const trackingClause = part.clause.replace(STAGES_SUFFIX, "");
  const trackingAction = getAstroAction("tracking.create")!;
  const names = stages.split(/\s*,\s*|\s+e\s+/).map((name) => name.trim()).filter(Boolean);
  return [
    { ...part, clause: trackingClause, fields: toStringFields(trackingAction.inferFields?.(trackingClause) ?? {}) },
    ...names.map((statusName) => ({
      actionKey: "tracking.create_status",
      clause: statusName,
      fields: { statusName },
      trackingFrom: index,
      dependsOn: index,
    })),
  ];
}

/**
 * `null` = não é pedido composto (um trecho só, ou os trechos se juntaram de
 * volta num verbo). O ciclo de um verbo segue com a frase inteira.
 */
export async function draftPlan(ctx: AgentContext, text: string): Promise<PlanDraft | null> {
  const clauses = splitIntoClauses(text);
  if (clauses.length < 2 && !STAGES_SUFFIX.test(text)) return null;

  const parts: PlanPart[] = [];
  for (const clause of clauses) {
    const previousIndex = parts.length - 1;
    const part = await partForClause(ctx, clause, parts[previousIndex], previousIndex);
    if (part === "merge") {
      const merged = `${parts[previousIndex].clause} e ${clause}`;
      const action = getAstroAction(parts[previousIndex].actionKey)!;
      parts[previousIndex] = {
        ...parts[previousIndex],
        clause: merged,
        fields: { ...parts[previousIndex].fields, ...toStringFields(action.inferFields?.(merged) ?? {}) },
      };
      continue;
    }
    parts.push(...expandStages(part, parts.length));
  }

  const spokenParts = parts.filter((part) => part.trackingFrom === undefined).length;
  const hasStages = parts.length > spokenParts;
  if (spokenParts < 2 && !hasStages) return null;
  // Etapas expandidas não contam: "funil com 3 etapas" é um pedido só.
  if (spokenParts > MAX_PLAN_PARTS) return { kind: "too_many", count: spokenParts };
  return { kind: "plan", parts };
}
