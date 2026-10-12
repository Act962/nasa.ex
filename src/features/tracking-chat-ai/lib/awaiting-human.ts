import "server-only";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import { LEAD_AWAITING_HUMAN_EVENT } from "@/features/alerts/lib/lead-awaiting-human-event";
import { applyAwaitingTagNow } from "@/features/org-defaults/lib/auto-tags";

// A assistente parou de atender e o cliente espera uma pessoa. Sem este aviso a equipe só
// descobria ao abrir o chat. Reaproveita a tag padrão "Aguard. atendimento" (que dispara os
// fluxos de "lead recebe uma tag") e o motor de alertas (sino, aviso na tela, push, ASTRO).

export type AwaitingHumanReason = "client_asked" | "assistant_could_not_solve" | "usage_limit" | "no_balance";

const REASON_TEXT: Record<AwaitingHumanReason, string> = {
  client_asked: "pediu para falar com um atendente",
  assistant_could_not_solve: "precisa de um atendente",
  usage_limit: "atingiu o limite de respostas da assistente e espera um atendente",
  no_balance: "espera um atendente (assistente sem saldo de Stars)",
};

/** Nunca lança: falha de aviso não pode impedir a transferência nem a mensagem ao cliente. */
export async function signalLeadAwaitingHuman(params: {
  organizationId: string;
  leadId: string;
  conversationId: string;
  reason: AwaitingHumanReason;
}): Promise<void> {
  try {
    await applyAwaitingTagNow({ organizationId: params.organizationId, leadId: params.leadId });
  } catch (tagError) {
    console.warn("[tracking-chat-ai] tag de espera falhou", tagError instanceof Error ? tagError.message : "erro");
  }
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.leadId },
      select: { name: true, phone: true, responsibleId: true },
    });
    const leadLabel = lead?.name && lead.name !== "Sem nome" ? lead.name : (lead?.phone ?? "Um cliente");
    await dispatchAlert(
      LEAD_AWAITING_HUMAN_EVENT,
      { leadId: params.leadId, conversationId: params.conversationId, leadName: leadLabel, reason: params.reason },
      {
        bypassRules: {
          title: "Cliente aguardando atendente",
          body: `${leadLabel} ${REASON_TEXT[params.reason]}.`,
          severity: "warning",
          // Responsável pelo lead; sem responsável, quem administra a empresa.
          audience: lead?.responsibleId ? { kind: "user", userIds: [lead.responsibleId] } : { kind: "org_admins" },
          actionUrl: `/tracking-chat/${params.conversationId}`,
          orgId: params.organizationId,
          createdBy: "SYSTEM",
        },
      },
    );
  } catch (alertError) {
    console.warn("[tracking-chat-ai] aviso à equipe falhou", alertError instanceof Error ? alertError.message : "erro");
  }
}
