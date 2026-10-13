import "server-only";
import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import type { LoyaltyActor } from "../actor";
import { auditLoyaltyAction } from "../audit";

// Sorteio da campanha (spec 0102, RF-11). Só entre números válidos e só depois de uma varredura
// que tenha visto todos os cupons. A semente fica gravada: com ela e a lista ordenada de códigos,
// qualquer pessoa refaz a conta e chega ao mesmo ganhador.

export function pickWinnerIndex(seed: string, totalNumbers: number): number {
  const digest = createHash("sha256").update(seed).digest("hex");
  return Number(BigInt(`0x${digest}`) % BigInt(totalNumbers));
}

export async function drawCampaignWinner(params: { organizationId: string; campaignId: string; actor: LoyaltyActor }) {
  const campaign = await prisma.loyaltyCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.organizationId },
    select: { id: true, name: true, lastSweepAt: true, drawnAt: true },
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
    select: { id: true, code: true, member: { select: { name: true, phone: true } } },
  });
  if (validNumbers.length === 0) return { ok: false as const, reason: "no_numbers" as const };

  const drawSeed = randomBytes(32).toString("hex");
  const winner = validNumbers[pickWinnerIndex(drawSeed, validNumbers.length)];
  // A condição `drawnAt: null` impede dois sorteios simultâneos de gravarem ganhadores diferentes.
  const saved = await prisma.loyaltyCampaign.updateMany({
    where: { id: campaign.id, drawnAt: null },
    data: { drawnAt: new Date(), drawSeed, winnerNumberId: winner.id, isActive: false },
  });
  if (saved.count === 0) return { ok: false as const, reason: "already_drawn" as const };

  await auditLoyaltyAction({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "campaign.draw",
    actionLabel: `${campaign.name}: sorteado o número ${winner.code} (${winner.member.name})`,
    resourceId: campaign.id,
    metadata: { totalNumbers: validNumbers.length, winnerCode: winner.code },
  });
  return { ok: true as const, winnerCode: winner.code, winnerName: winner.member.name, winnerPhone: winner.member.phone, totalNumbers: validNumbers.length };
}
