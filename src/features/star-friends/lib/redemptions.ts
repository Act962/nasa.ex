import "server-only";
import prisma from "@/lib/prisma";
import type { LoyaltyRedemptionChannel } from "@/generated/prisma/enums";
import { canAfford } from "../utils/balance";
import type { LoyaltyActor } from "./actor";
import { auditLoyaltyAction } from "./audit";
import { findOrCreateMemberForLead } from "./members";
import { getActiveProgram } from "./program";

export class LoyaltyRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoyaltyRuleError";
  }
}

// Canais com humano na ponta aprovam na hora; Astro e portal ficam pendentes.
const AUTO_APPROVED_CHANNELS: ReadonlySet<LoyaltyRedemptionChannel> = new Set(["CONSULTANT", "CHAT"]);

export async function requestRedemption(input: {
  organizationId: string;
  leadId: string;
  rewardId: string;
  channel: LoyaltyRedemptionChannel;
  actor: LoyaltyActor;
  note?: string | null;
}) {
  const program = await getActiveProgram(input.organizationId);
  if (!program) throw new LoyaltyRuleError("O STAR FRIENDS não está ativo nesta organização.");

  const reward = await prisma.loyaltyReward.findFirst({
    where: { id: input.rewardId, organizationId: input.organizationId, isActive: true },
  });
  if (!reward) throw new LoyaltyRuleError("Prêmio não encontrado ou inativo.");
  if (reward.stock !== null && reward.stock <= 0) throw new LoyaltyRuleError("Prêmio sem estoque.");

  const member = await findOrCreateMemberForLead(input.organizationId, input.leadId);
  if (!member) throw new LoyaltyRuleError("O cliente precisa de telefone para participar do programa.");

  const redemption = await prisma.loyaltyRedemption.create({
    data: {
      organizationId: input.organizationId,
      memberId: member.id,
      rewardId: reward.id,
      leadId: input.leadId,
      costStars: reward.costStars,
      rewardSnapshot: {
        name: reward.name,
        type: reward.type,
        costStars: reward.costStars,
        discountValue: reward.discountValue ? Number(reward.discountValue) : null,
        discountPercent: reward.discountPercent,
      },
      requestedVia: input.channel,
      requestedByType: input.actor.type,
      requestedByUserId: input.actor.userId,
      requestedByName: input.actor.name,
      note: input.note ?? null,
    },
  });

  await auditLoyaltyAction({
    organizationId: input.organizationId,
    actor: input.actor,
    action: "redemption.requested",
    actionLabel: `Pedido de resgate "${reward.name}" (${reward.costStars} stars) para ${member.name} via ${input.channel}`,
    leadId: input.leadId,
    resourceId: redemption.id,
    metadata: { rewardId: reward.id, channel: input.channel },
  });

  if (AUTO_APPROVED_CHANNELS.has(input.channel) && input.actor.type === "USER") {
    return approveRedemption({
      organizationId: input.organizationId,
      redemptionId: redemption.id,
      actor: input.actor,
    });
  }
  return redemption;
}

// Débito e baixa de estoque na mesma transação serializável: dois resgates
// simultâneos não conseguem gastar o mesmo saldo.
export async function approveRedemption(input: {
  organizationId: string;
  redemptionId: string;
  actor: LoyaltyActor;
}) {
  const approved = await prisma.$transaction(
    async (tx) => {
      const redemption = await tx.loyaltyRedemption.findFirst({
        where: { id: input.redemptionId, organizationId: input.organizationId },
        include: { reward: true, member: true },
      });
      if (!redemption) throw new LoyaltyRuleError("Resgate não encontrado.");
      if (redemption.status !== "PENDING") {
        throw new LoyaltyRuleError(`Resgate já está ${redemption.status}.`);
      }
      const balance =
        (await tx.loyaltyLedgerEntry.aggregate({
          where: { memberId: redemption.memberId },
          _sum: { stars: true },
        }))._sum.stars ?? 0;
      if (!canAfford(balance, redemption.costStars)) {
        throw new LoyaltyRuleError(
          `Saldo insuficiente: ${balance} stars, o prêmio custa ${redemption.costStars}.`,
        );
      }
      if (redemption.reward.stock !== null) {
        const stockUpdate = await tx.loyaltyReward.updateMany({
          where: { id: redemption.rewardId, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (stockUpdate.count === 0) throw new LoyaltyRuleError("Prêmio sem estoque.");
      }
      await tx.loyaltyLedgerEntry.create({
        data: {
          organizationId: input.organizationId,
          memberId: redemption.memberId,
          leadId: redemption.leadId,
          type: "REDEEM",
          stars: -redemption.costStars,
          source: "REDEMPTION",
          sourceId: redemption.id,
          itemsSnapshot: redemption.rewardSnapshot ?? undefined,
          actorType: input.actor.type,
          actorUserId: input.actor.userId,
          actorName: input.actor.name,
        },
      });
      return tx.loyaltyRedemption.update({
        where: { id: redemption.id },
        data: {
          status: "APPROVED",
          decidedByUserId: input.actor.userId,
          decidedByName: input.actor.name,
          decidedAt: new Date(),
        },
        include: { reward: true, member: true },
      });
    },
    { isolationLevel: "Serializable" },
  );

  await auditLoyaltyAction({
    organizationId: input.organizationId,
    actor: input.actor,
    action: "redemption.approved",
    actionLabel: `Aprovou resgate "${approved.reward.name}" (-${approved.costStars} stars) de ${approved.member.name}`,
    leadId: approved.leadId,
    resourceId: approved.id,
  });
  return approved;
}

export async function rejectRedemption(input: {
  organizationId: string;
  redemptionId: string;
  actor: LoyaltyActor;
  reason: string;
}) {
  const claim = await prisma.loyaltyRedemption.updateMany({
    where: { id: input.redemptionId, organizationId: input.organizationId, status: "PENDING" },
    data: {
      status: "REJECTED",
      decidedByUserId: input.actor.userId,
      decidedByName: input.actor.name,
      decidedAt: new Date(),
      decisionReason: input.reason,
    },
  });
  if (claim.count === 0) throw new LoyaltyRuleError("Só resgates pendentes podem ser recusados.");
  const redemption = await prisma.loyaltyRedemption.findUniqueOrThrow({
    where: { id: input.redemptionId },
    include: { reward: true, member: true },
  });
  await auditLoyaltyAction({
    organizationId: input.organizationId,
    actor: input.actor,
    action: "redemption.rejected",
    actionLabel: `Recusou resgate "${redemption.reward.name}" de ${redemption.member.name}: ${input.reason}`,
    leadId: redemption.leadId,
    resourceId: redemption.id,
  });
  return redemption;
}

export async function deliverRedemption(input: {
  organizationId: string;
  redemptionId: string;
  actor: LoyaltyActor;
}) {
  const claim = await prisma.loyaltyRedemption.updateMany({
    where: { id: input.redemptionId, organizationId: input.organizationId, status: "APPROVED" },
    data: {
      status: "DELIVERED",
      deliveredByUserId: input.actor.userId,
      deliveredByName: input.actor.name,
      deliveredAt: new Date(),
    },
  });
  if (claim.count === 0) throw new LoyaltyRuleError("Só resgates aprovados podem ser entregues.");
  const redemption = await prisma.loyaltyRedemption.findUniqueOrThrow({
    where: { id: input.redemptionId },
    include: { reward: true, member: true },
  });
  await auditLoyaltyAction({
    organizationId: input.organizationId,
    actor: input.actor,
    action: "redemption.delivered",
    actionLabel: `Entregou "${redemption.reward.name}" para ${redemption.member.name}`,
    leadId: redemption.leadId,
    resourceId: redemption.id,
  });
  return redemption;
}

// Cancelar um resgate aprovado devolve as stars por estorno — o débito
// original continua no extrato.
export async function cancelRedemption(input: {
  organizationId: string;
  redemptionId: string;
  actor: LoyaltyActor;
  reason: string;
}) {
  const canceled = await prisma.$transaction(async (tx) => {
    const redemption = await tx.loyaltyRedemption.findFirst({
      where: { id: input.redemptionId, organizationId: input.organizationId },
      include: { reward: true, member: true },
    });
    if (!redemption) throw new LoyaltyRuleError("Resgate não encontrado.");
    if (redemption.status !== "APPROVED" && redemption.status !== "PENDING") {
      throw new LoyaltyRuleError(`Resgate ${redemption.status} não pode ser cancelado.`);
    }
    if (redemption.status === "APPROVED") {
      await tx.loyaltyLedgerEntry.create({
        data: {
          organizationId: input.organizationId,
          memberId: redemption.memberId,
          leadId: redemption.leadId,
          type: "REVERSAL",
          stars: redemption.costStars,
          source: "REDEMPTION",
          sourceId: redemption.id,
          reason: input.reason,
          actorType: input.actor.type,
          actorUserId: input.actor.userId,
          actorName: input.actor.name,
        },
      });
      if (redemption.reward.stock !== null) {
        await tx.loyaltyReward.update({
          where: { id: redemption.rewardId },
          data: { stock: { increment: 1 } },
        });
      }
    }
    return tx.loyaltyRedemption.update({
      where: { id: redemption.id },
      data: {
        status: "CANCELED",
        decidedByUserId: input.actor.userId,
        decidedByName: input.actor.name,
        decidedAt: new Date(),
        decisionReason: input.reason,
      },
      include: { reward: true, member: true },
    });
  });
  await auditLoyaltyAction({
    organizationId: input.organizationId,
    actor: input.actor,
    action: "redemption.canceled",
    actionLabel: `Cancelou resgate "${canceled.reward.name}" de ${canceled.member.name}: ${input.reason}`,
    leadId: canceled.leadId,
    resourceId: canceled.id,
  });
  return canceled;
}
