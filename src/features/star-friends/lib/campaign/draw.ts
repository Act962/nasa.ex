import "server-only";
import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import type { LoyaltyActor } from "../actor";
import { auditLoyaltyAction } from "../audit";

// Sorteio da campanha (spec 0102, RF-11 e RF-16). Só entre números válidos e só depois de uma varredura
// que tenha visto todos os cupons. A semente fica gravada: com ela e a lista ordenada de códigos,
// qualquer pessoa refaz a conta e chega ao mesmo ganhador.

export function pickWinnerIndex(seed: string, totalNumbers: number): number {
  const digest = createHash("sha256").update(seed).digest("hex");
  return Number(BigInt(`0x${digest}`) % BigInt(totalNumbers));
}

type DrawableNumber = { id: string; code: string; memberId: string };

/**
 * Sorteia até `prizeCount` números, um prêmio por pessoa: depois de cada sorteado, os outros
 * números do mesmo cliente saem da lista. Recebe os números em ordem de código.
 */
export function pickWinners<TNumber extends DrawableNumber>(seed: string, numbersByCode: TNumber[], prizeCount: number): TNumber[] {
  const winners: TNumber[] = [];
  let remaining = numbersByCode;
  while (winners.length < prizeCount && remaining.length > 0) {
    const winner = remaining[pickWinnerIndex(`${seed}:${winners.length + 1}`, remaining.length)];
    winners.push(winner);
    remaining = remaining.filter((luckyNumber) => luckyNumber.memberId !== winner.memberId);
  }
  return winners;
}

export async function drawCampaignWinner(params: { organizationId: string; campaignId: string; actor: LoyaltyActor }) {
  const campaign = await prisma.loyaltyCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.organizationId },
    select: { id: true, name: true, lastSweepAt: true, drawnAt: true, prizeCount: true },
  });
  if (!campaign) return { ok: false as const, reason: "not_found" as const };
  if (campaign.drawnAt) return { ok: false as const, reason: "already_drawn" as const };
  if (!campaign.lastSweepAt) return { ok: false as const, reason: "sweep_required" as const };

  const receiptAfterSweep = await prisma.loyaltyReceipt.findFirst({
    where: { campaignId: campaign.id, status: "ACCEPTED", createdAt: { gt: campaign.lastSweepAt } },
    select: { id: true },
  });
  if (receiptAfterSweep) return { ok: false as const, reason: "sweep_required" as const };

  const receiptInReview = await prisma.loyaltyReceipt.findFirst({
    where: { campaignId: campaign.id, status: "PENDING_REVIEW" },
    select: { id: true },
  });
  if (receiptInReview) return { ok: false as const, reason: "pending_review" as const };

  const validNumbers = await prisma.loyaltyLuckyNumber.findMany({
    where: { campaignId: campaign.id, status: "VALID" },
    orderBy: { code: "asc" },
    select: { id: true, code: true, memberId: true, member: { select: { name: true, phone: true } } },
  });
  if (validNumbers.length === 0) return { ok: false as const, reason: "no_numbers" as const };

  const drawSeed = randomBytes(32).toString("hex");
  const winners = pickWinners(drawSeed, validNumbers, campaign.prizeCount);
  // A condição `drawnAt: null` impede dois sorteios simultâneos de gravarem ganhadores diferentes.
  const hasSaved = await prisma.$transaction(async (tx) => {
    const saved = await tx.loyaltyCampaign.updateMany({
      where: { id: campaign.id, drawnAt: null },
      data: { drawnAt: new Date(), drawSeed, winnerNumberId: winners[0].id, isActive: false },
    });
    if (saved.count === 0) return false;
    for (const [winnerIndex, winner] of winners.entries()) {
      await tx.loyaltyLuckyNumber.update({ where: { id: winner.id }, data: { drawPosition: winnerIndex + 1 } });
    }
    return true;
  });
  if (!hasSaved) return { ok: false as const, reason: "already_drawn" as const };

  const winnersSummary = winners.map((winner) => `${winner.code} (${winner.member.name})`).join(", ");
  await auditLoyaltyAction({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "campaign.draw",
    actionLabel: `${campaign.name}: sorteados ${winnersSummary}`,
    resourceId: campaign.id,
    metadata: { totalNumbers: validNumbers.length, winners: winners.length, prizeCount: campaign.prizeCount },
  });
  return {
    ok: true as const,
    totalNumbers: validNumbers.length,
    winners: winners.map((winner, winnerIndex) => ({ position: winnerIndex + 1, code: winner.code, name: winner.member.name, phone: winner.member.phone })),
  };
}
