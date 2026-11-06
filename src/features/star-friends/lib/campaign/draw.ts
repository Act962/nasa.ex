import "server-only";
import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import type { LoyaltyActor } from "../actor";
import { auditLoyaltyAction } from "../audit";
import { firstAndLastName, isDrawRevocable, maskPhone, nextFreePosition } from "../../utils/live-draw";

// Sorteio ao vivo da campanha (spec 0102 RF-11/RF-16 e spec 0134): um número por vez, entre os
// números válidos, depois de uma varredura que tenha visto todos os cupons. Cada número tirado
// grava a semente e o tamanho da lista: com eles e a lista ordenada por código, qualquer pessoa
// refaz a conta. Um sorteio pode ser revogado por 30 minutos e o prêmio volta a ficar livre.

const POOL_SAMPLE_LIMIT = 3000;

export function pickWinnerIndex(seed: string, totalNumbers: number): number {
  const digest = createHash("sha256").update(seed).digest("hex");
  return Number(BigInt(`0x${digest}`) % BigInt(totalNumbers));
}

type DrawFailure = "not_found" | "already_drawn" | "sweep_required" | "pending_review" | "no_numbers";
type RevokeFailure = "not_found" | "already_revoked" | "revoke_expired";
type PrizeCountFailure = "not_found" | "prize_below_winners";

class DrawAbort extends Error {
  constructor(readonly reason: DrawFailure | RevokeFailure | PrizeCountFailure) {
    super(reason);
  }
}

async function findDrawBlocker(campaign: { id: string; lastSweepAt: Date | null }): Promise<DrawFailure | null> {
  if (!campaign.lastSweepAt) return "sweep_required";
  const [receiptAfterSweep, receiptInReview] = await Promise.all([
    prisma.loyaltyReceipt.findFirst({
      where: { campaignId: campaign.id, status: "ACCEPTED", createdAt: { gt: campaign.lastSweepAt } },
      select: { id: true },
    }),
    prisma.loyaltyReceipt.findFirst({ where: { campaignId: campaign.id, status: "PENDING_REVIEW" }, select: { id: true } }),
  ]);
  if (receiptAfterSweep) return "sweep_required";
  if (receiptInReview) return "pending_review";
  return null;
}

export async function drawNextWinner(params: { organizationId: string; campaignId: string; actor: LoyaltyActor }) {
  const campaign = await prisma.loyaltyCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.organizationId },
    select: { id: true, name: true, lastSweepAt: true, drawnAt: true },
  });
  if (!campaign) return { ok: false as const, reason: "not_found" as const };
  if (campaign.drawnAt) return { ok: false as const, reason: "already_drawn" as const };
  const blocker = await findDrawBlocker(campaign);
  if (blocker) return { ok: false as const, reason: blocker };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Primeira escrita trava a linha da campanha: dois cliques não tiram dois números para o mesmo
      // prêmio. O sorteio também fecha a campanha para cupons novos.
      const locked = await tx.loyaltyCampaign.update({
        where: { id: campaign.id },
        data: { isActive: false },
        select: { prizeCount: true },
      });
      const activeDraws = await tx.loyaltyCampaignDraw.findMany({
        where: { campaignId: campaign.id, revokedAt: null },
        select: { position: true, memberId: true },
      });
      const position = nextFreePosition(
        activeDraws.map((draw) => draw.position),
        locked.prizeCount,
      );
      if (position === null) throw new DrawAbort("already_drawn");

      const winnerMemberIds = activeDraws.flatMap((draw) => (draw.memberId ? [draw.memberId] : []));
      const pool = await tx.loyaltyLuckyNumber.findMany({
        where: { campaignId: campaign.id, status: "VALID", drawPosition: null, memberId: { notIn: winnerMemberIds } },
        orderBy: { code: "asc" },
        select: { id: true, code: true, memberId: true, member: { select: { name: true, phone: true } } },
      });
      if (pool.length === 0) throw new DrawAbort("no_numbers");

      const seed = randomBytes(32).toString("hex");
      const winner = pool[pickWinnerIndex(seed, pool.length)];
      const draw = await tx.loyaltyCampaignDraw.create({
        data: {
          campaignId: campaign.id,
          luckyNumberId: winner.id,
          memberId: winner.memberId,
          position,
          code: winner.code,
          memberName: winner.member.name,
          memberPhone: winner.member.phone,
          seed,
          poolSize: pool.length,
          actorUserId: params.actor.userId,
          actorName: params.actor.name,
        },
      });
      await tx.loyaltyLuckyNumber.update({ where: { id: winner.id }, data: { drawPosition: position } });
      const winnersCount = activeDraws.length + 1;
      const isComplete = winnersCount >= locked.prizeCount;
      await tx.loyaltyCampaign.update({
        where: { id: campaign.id },
        data: { drawnAt: isComplete ? new Date() : null, ...(position === 1 ? { winnerNumberId: winner.id, drawSeed: seed } : {}) },
      });
      return { draw, poolSize: pool.length, winnersCount, prizeCount: locked.prizeCount, isComplete };
    });

    await auditLoyaltyAction({
      organizationId: params.organizationId,
      actor: params.actor,
      action: "campaign.draw",
      actionLabel: `${campaign.name}: ${result.draw.position}º prêmio sorteado, número ${result.draw.code} (${result.draw.memberName})`,
      resourceId: campaign.id,
      metadata: { drawId: result.draw.id, position: result.draw.position, poolSize: result.poolSize, seed: result.draw.seed },
    });
    return {
      ok: true as const,
      draw: {
        id: result.draw.id,
        position: result.draw.position,
        code: result.draw.code,
        name: result.draw.memberName,
        displayName: firstAndLastName(result.draw.memberName),
        maskedPhone: maskPhone(result.draw.memberPhone),
        drawnAt: result.draw.drawnAt,
      },
      poolSize: result.poolSize,
      winnersCount: result.winnersCount,
      prizeCount: result.prizeCount,
      isComplete: result.isComplete,
    };
  } catch (error) {
    if (error instanceof DrawAbort) return { ok: false as const, reason: error.reason as DrawFailure };
    throw error;
  }
}

export async function revokeCampaignDraw(params: { organizationId: string; drawId: string; reason: string | null; actor: LoyaltyActor }) {
  const draw = await prisma.loyaltyCampaignDraw.findFirst({
    where: { id: params.drawId, campaign: { organizationId: params.organizationId } },
    select: { id: true, campaignId: true, luckyNumberId: true, position: true, code: true, memberName: true, drawnAt: true, revokedAt: true, campaign: { select: { name: true } } },
  });
  if (!draw) return { ok: false as const, reason: "not_found" as const };
  if (draw.revokedAt) return { ok: false as const, reason: "already_revoked" as const };
  if (!isDrawRevocable(draw)) return { ok: false as const, reason: "revoke_expired" as const };

  const reason = params.reason?.trim() || "Sorteado sem querer";
  try {
    await prisma.$transaction(async (tx) => {
      await tx.loyaltyCampaign.update({ where: { id: draw.campaignId }, data: { drawnAt: null } });
      const revoked = await tx.loyaltyCampaignDraw.updateMany({
        where: { id: draw.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedByName: params.actor.name, revokeReason: reason },
      });
      if (revoked.count === 0) throw new DrawAbort("already_revoked");
      if (draw.luckyNumberId) {
        await tx.loyaltyLuckyNumber.updateMany({ where: { id: draw.luckyNumberId, drawPosition: draw.position }, data: { drawPosition: null } });
        await tx.loyaltyCampaign.updateMany({ where: { id: draw.campaignId, winnerNumberId: draw.luckyNumberId }, data: { winnerNumberId: null } });
      }
    });
  } catch (error) {
    if (error instanceof DrawAbort) return { ok: false as const, reason: error.reason as RevokeFailure };
    throw error;
  }

  await auditLoyaltyAction({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "campaign.draw_revoked",
    actionLabel: `${draw.campaign.name}: sorteio do ${draw.position}º prêmio revogado (número ${draw.code}, ${draw.memberName}). Motivo: ${reason}`,
    resourceId: draw.campaignId,
    metadata: { drawId: draw.id, position: draw.position },
  });
  return { ok: true as const, position: draw.position };
}

export async function setCampaignPrizeCount(params: { organizationId: string; campaignId: string; prizeCount: number; actor: LoyaltyActor }) {
  const campaign = await prisma.loyaltyCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.organizationId },
    select: { id: true, name: true, prizeCount: true },
  });
  if (!campaign) return { ok: false as const, reason: "not_found" as const };

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.loyaltyCampaign.update({ where: { id: campaign.id }, data: { prizeCount: params.prizeCount }, select: { drawnAt: true } });
      const activeDraws = await tx.loyaltyCampaignDraw.findMany({ where: { campaignId: campaign.id, revokedAt: null }, select: { position: true } });
      if (activeDraws.some((draw) => draw.position > params.prizeCount)) throw new DrawAbort("prize_below_winners");
      const isComplete = activeDraws.length > 0 && activeDraws.length >= params.prizeCount;
      await tx.loyaltyCampaign.update({ where: { id: campaign.id }, data: { drawnAt: isComplete ? (locked.drawnAt ?? new Date()) : null } });
    });
  } catch (error) {
    if (error instanceof DrawAbort) return { ok: false as const, reason: error.reason as PrizeCountFailure };
    throw error;
  }

  if (campaign.prizeCount !== params.prizeCount) {
    await auditLoyaltyAction({
      organizationId: params.organizationId,
      actor: params.actor,
      action: "campaign.prize_count",
      actionLabel: `${campaign.name}: ganhadores de ${campaign.prizeCount} para ${params.prizeCount}`,
      resourceId: campaign.id,
    });
  }
  return { ok: true as const, prizeCount: params.prizeCount };
}

/**
 * Nomes que passam na tela do sorteio e base do simulador. Amostra aleatória quando a campanha
 * tem muitos números; telefone sempre mascarado, porque a tela vai para o telão.
 */
export async function getCampaignDrawPool(params: { organizationId: string; campaignId: string }) {
  const numbers = await prisma.loyaltyLuckyNumber.findMany({
    where: { campaignId: params.campaignId, status: "VALID", campaign: { organizationId: params.organizationId } },
    select: { code: true, memberId: true, member: { select: { name: true, phone: true } } },
  });
  const participants = new Set(numbers.map((luckyNumber) => luckyNumber.memberId)).size;
  for (let index = numbers.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
  }
  return {
    totalNumbers: numbers.length,
    totalParticipants: participants,
    entries: numbers.slice(0, POOL_SAMPLE_LIMIT).map((luckyNumber) => ({
      code: luckyNumber.code,
      memberKey: luckyNumber.memberId,
      displayName: firstAndLastName(luckyNumber.member.name),
      maskedPhone: maskPhone(luckyNumber.member.phone),
    })),
  };
}
