import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import type { LoyaltyActor } from "./actor";
import { auditLoyaltyAction } from "./audit";
import { findOrCreateMemberForLead, getMemberBalance } from "./members";
import { LoyaltyRuleError } from "./redemptions";

// Lançamento manual exige motivo e nunca deixa o saldo negativo.
export async function adjustStars(input: {
  organizationId: string;
  leadId: string;
  stars: number;
  reason: string;
  actor: LoyaltyActor;
}) {
  if (!Number.isInteger(input.stars) || input.stars === 0) {
    throw new LoyaltyRuleError("Informe uma quantidade inteira diferente de zero.");
  }
  if (input.reason.trim().length < 5) throw new LoyaltyRuleError("Descreva o motivo do ajuste.");

  const member = await findOrCreateMemberForLead(input.organizationId, input.leadId);
  if (!member) throw new LoyaltyRuleError("O cliente precisa de telefone para participar do programa.");

  if (input.stars < 0) {
    const balance = await getMemberBalance(member.id);
    if (balance + input.stars < 0) {
      throw new LoyaltyRuleError(`Saldo insuficiente: ${balance} stars.`);
    }
  }

  const entry = await prisma.loyaltyLedgerEntry.create({
    data: {
      organizationId: input.organizationId,
      memberId: member.id,
      leadId: input.leadId,
      type: input.stars > 0 ? "ADJUST_CREDIT" : "ADJUST_DEBIT",
      stars: input.stars,
      source: "MANUAL",
      sourceId: randomUUID(),
      reason: input.reason.trim(),
      actorType: input.actor.type,
      actorUserId: input.actor.userId,
      actorName: input.actor.name,
    },
  });

  await auditLoyaltyAction({
    organizationId: input.organizationId,
    actor: input.actor,
    action: input.stars > 0 ? "stars.credited" : "stars.debited",
    actionLabel: `${input.stars > 0 ? "+" : ""}${input.stars} star(s) manual para ${member.name}: ${input.reason.trim()}`,
    leadId: input.leadId,
    resourceId: entry.id,
  });
  return entry;
}
