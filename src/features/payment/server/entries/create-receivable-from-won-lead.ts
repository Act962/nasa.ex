import "server-only";

import prisma from "@/lib/prisma";
import {
  buildWonLeadReceivableDescription,
  decideWonLeadReceivable,
  toSaoPauloDateInput,
  type WonLeadReceivableSkipReason,
} from "@/features/payment/lib/won-lead-receivable";
import { createPaymentEntryRecord } from "./create-entry";
import type { PaymentActor } from "./entry-include";

// Lead marcado como GANHO vira conta a receber no financeiro (spec 0074).
// Chamado sempre depois do commit que grava o GANHO e nunca lança: falha aqui
// não pode desfazer nem derrubar o fechamento do lead (regra 18).

export type WonLeadReceivableResult =
  | { created: true; entryId: string }
  | { created: false; reason: WonLeadReceivableSkipReason | "lead_not_found" | "failed" };

export async function createReceivableFromWonLead(params: {
  leadId: string;
  /** Quem marcou o ganho. Ausente nas automações — cai no responsável do lead. */
  actor?: PaymentActor | null;
}): Promise<WonLeadReceivableResult> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.leadId },
      select: {
        id: true,
        name: true,
        amount: true,
        trackingId: true,
        responsibleId: true,
        tracking: { select: { organizationId: true } },
      },
    });
    if (!lead) return { created: false, reason: "lead_not_found" };

    const [linkedReceivable, actor] = await Promise.all([
      prisma.paymentEntry.findFirst({
        where: {
          leadId: lead.id,
          type: "RECEIVABLE",
          status: { not: "CANCELLED" },
        },
        select: { id: true },
      }),
      params.actor ?? resolveAutomationActor(lead.responsibleId, lead.trackingId),
    ]);

    const decision = decideWonLeadReceivable({
      leadAmountCents: Number(lead.amount),
      hasLinkedReceivable: linkedReceivable !== null,
      hasActor: actor !== null,
    });
    if (!decision.shouldCreate) return { created: false, reason: decision.reason };
    if (!actor) return { created: false, reason: "no_actor" };

    const [entry] = await createPaymentEntryRecord({
      organizationId: lead.tracking.organizationId,
      actor,
      input: {
        type: "RECEIVABLE",
        description: buildWonLeadReceivableDescription(lead.name),
        amount: decision.amountCents,
        dueDate: toSaoPauloDateInput(new Date()),
        trackingId: lead.trackingId,
        leadId: lead.id,
        notes: "Gerado automaticamente ao marcar o lead como ganho.",
      },
    });

    return { created: true, entryId: entry.id };
  } catch (error) {
    console.error("[payment/won-lead-receivable] failed:", params.leadId, error);
    return { created: false, reason: "failed" };
  }
}

async function resolveAutomationActor(
  responsibleId: string | null,
  trackingId: string,
): Promise<PaymentActor | null> {
  if (responsibleId) {
    const responsible = await prisma.user.findUnique({
      where: { id: responsibleId },
      select: { id: true, name: true, email: true, image: true },
    });
    if (responsible) return responsible;
  }

  const ownerParticipant = await prisma.trackingParticipant.findFirst({
    where: { trackingId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, name: true, email: true, image: true } } },
  });
  return ownerParticipant?.user ?? null;
}
