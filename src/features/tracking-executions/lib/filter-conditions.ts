/**
 * Avaliação do passo "Filtrar Leads", compartilhada pelo motor clássico e pelo Modo Agente
 * (spec 0112). Lê o lead na hora da avaliação: depois de uma espera, tag e coluna já podem ter mudado.
 */
import prisma from "@/lib/prisma";
import type {
  FilterCondition,
  FilterLeadFormValues,
} from "../components/filter-lead/dialog";
import {
  normalizeLeadMessageText,
  type WorkflowLeadMessage,
} from "./lead-message";

const INTEREST_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

type FilterLead = {
  statusId: string;
  name: string;
  email: string | null;
  amount: unknown;
  tagIds: string[];
  interestLevel: keyof typeof INTEREST_RANK | null;
};

/**
 * Sem mensagem no payload, TODA condição de mensagem é falsa — inclusive `not_contains`
 * (spec 0008, D-3). Um lead que nunca escreveu nada não "não contém" algo.
 */
function evaluateLeadMessageCondition(
  leadMessage: WorkflowLeadMessage | undefined,
  operator: "contains" | "not_contains" | "equals",
  value: string,
): boolean {
  if (!leadMessage?.text) return false;

  const messageText = normalizeLeadMessageText(leadMessage.text);
  const expectedText = normalizeLeadMessageText(value);
  if (!expectedText) return false;

  switch (operator) {
    case "contains":
      return messageText.includes(expectedText);
    case "not_contains":
      return !messageText.includes(expectedText);
    case "equals":
      return messageText === expectedText;
  }
}

/**
 * "O cliente escreveu de novo depois da mensagem que iniciou o fluxo?" A mensagem mais recente
 * dele na conversa precisa ser a do gatilho. Mensagens no mesmo segundo desempatam pela ordem de
 * gravação, para um álbum de fotos deixar seguir só o fluxo da última foto.
 */
async function hasLeadWrittenSince(
  leadId: string,
  triggerMessageId: string,
): Promise<boolean> {
  const latestLeadMessage = await prisma.message.findFirst({
    where: { fromMe: false, conversation: { leadId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { messageId: true },
  });
  return (
    latestLeadMessage !== null &&
    latestLeadMessage.messageId !== triggerMessageId
  );
}

function evaluateCondition(
  condition: FilterCondition,
  lead: FilterLead,
  leadMessage: WorkflowLeadMessage | undefined,
  hasWrittenSinceTrigger: boolean | null,
): boolean {
  switch (condition.field) {
    case "status": {
      const isMatch = condition.value.includes(lead.statusId);
      return condition.operator === "is" ? isMatch : !isMatch;
    }
    case "tag": {
      const hasMatch = condition.value.some((tagId) =>
        lead.tagIds.includes(tagId),
      );
      return condition.operator === "contains" ? hasMatch : !hasMatch;
    }
    case "value": {
      const leadAmount = Number(lead.amount);
      const targetValue = Number(condition.value);
      return condition.operator === "greater_than"
        ? leadAmount > targetValue
        : leadAmount < targetValue;
    }
    case "name":
      return (
        lead.name.toLowerCase().trim() === condition.value.toLowerCase().trim()
      );
    case "email":
      return (
        (lead.email || "").toLowerCase().trim() ===
        condition.value.toLowerCase().trim()
      );
    case "interest": {
      // Lead ainda sem Visão do Lead calculada não passa: não dá para afirmar o interesse.
      if (!lead.interestLevel) return false;
      return condition.operator === "is"
        ? lead.interestLevel === condition.value
        : INTEREST_RANK[lead.interestLevel] >= INTEREST_RANK[condition.value];
    }
    case "leadMessage":
      return evaluateLeadMessageCondition(
        leadMessage,
        condition.operator,
        condition.value,
      );
    case "leadReply":
      // Sem a mensagem do gatilho não há "desde quando" comparar: a condição não passa.
      if (hasWrittenSinceTrigger === null) return false;
      return condition.operator === "since_trigger"
        ? hasWrittenSinceTrigger
        : !hasWrittenSinceTrigger;
    default:
      return true;
  }
}

/** `null` quando o lead não existe mais. */
export async function evaluateLeadFilter(params: {
  filter: FilterLeadFormValues;
  leadId: string;
  leadMessage: WorkflowLeadMessage | undefined;
}): Promise<boolean | null> {
  const { filter, leadId, leadMessage } = params;
  if (!filter.conditions || filter.conditions.length === 0) return true;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      statusId: true,
      name: true,
      email: true,
      amount: true,
      leadTags: { select: { tagId: true } },
      metrics: { select: { interestLevel: true } },
    },
  });
  if (!lead) return null;

  const needsReplyCheck = filter.conditions.some(
    (condition) => condition.field === "leadReply",
  );
  const triggerMessageId = leadMessage?.messageId;
  const hasWrittenSinceTrigger =
    needsReplyCheck && triggerMessageId
      ? await hasLeadWrittenSince(leadId, triggerMessageId)
      : null;

  const filterLead: FilterLead = {
    statusId: lead.statusId,
    name: lead.name,
    email: lead.email,
    amount: lead.amount,
    tagIds: lead.leadTags.map((leadTag) => leadTag.tagId),
    interestLevel: lead.metrics?.interestLevel ?? null,
  };
  const results = filter.conditions.map((condition) =>
    evaluateCondition(condition, filterLead, leadMessage, hasWrittenSinceTrigger),
  );

  return filter.logic === "and"
    ? results.every(Boolean)
    : results.some(Boolean);
}
