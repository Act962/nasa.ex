import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { SYSTEM_ACTOR } from "../actor";
import { computeLuckyNumbers, formatLuckyCode } from "../../utils/campaign";

// Parte do registro que rende números da sorte e stars (spec 0102, RF-7 e RF-8). É a mesma para o
// cupom aceito na hora e para o aprovado na conferência; só muda como o cupom em si é gravado.

const LUCKY_CODE_SPACE = 1_000_000;

async function pickFreeLuckyCodes(tx: Prisma.TransactionClient, campaignId: string, quantity: number): Promise<string[]> {
  const codes = new Set<string>();
  while (codes.size < quantity) {
    const candidates = Array.from({ length: quantity - codes.size }, () => formatLuckyCode(randomInt(LUCKY_CODE_SPACE)));
    const takenCodes = await tx.loyaltyLuckyNumber.findMany({
      where: { campaignId, code: { in: candidates } },
      select: { code: true },
    });
    const taken = new Set(takenCodes.map((luckyNumber) => luckyNumber.code));
    for (const candidate of candidates) if (!taken.has(candidate)) codes.add(candidate);
  }
  return [...codes];
}

export async function grantLuckyNumbers(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    campaign: { id: string; name: string; amountPerNumberCents: number };
    memberId: string;
    leadId: string | null;
    totalCents: number;
    program: { starsExpireDays: number | null } | null;
    saveReceipt: (numbersAwarded: number) => Promise<{ id: string }>;
  },
): Promise<{ receiptId: string; codes: string[]; carryOverCents: number }> {
  const { campaign, totalCents, program } = params;
  // O incremento trava a linha do cadastro: dois cupons do mesmo cliente não calculam a sobra juntos.
  const entry = await tx.loyaltyCampaignEntry.update({
    where: { campaignId_memberId: { campaignId: campaign.id, memberId: params.memberId } },
    data: { totalSpentCents: { increment: totalCents } },
    select: { id: true, totalSpentCents: true },
  });
  const { numbers: quantity, carryOverCents } = computeLuckyNumbers({
    carryOverCents: (entry.totalSpentCents - totalCents) % campaign.amountPerNumberCents,
    totalCents,
    amountPerNumberCents: campaign.amountPerNumberCents,
  });
  await tx.loyaltyCampaignEntry.update({ where: { id: entry.id }, data: { carryOverCents } });

  const receipt = await params.saveReceipt(quantity);
  const codes = quantity > 0 ? await pickFreeLuckyCodes(tx, campaign.id, quantity) : [];
  if (codes.length > 0) {
    await tx.loyaltyLuckyNumber.createMany({
      data: codes.map((code) => ({ campaignId: campaign.id, memberId: params.memberId, receiptId: receipt.id, code })),
    });
  }
  if (program && quantity > 0) {
    await tx.loyaltyLedgerEntry.create({
      data: {
        organizationId: params.organizationId,
        memberId: params.memberId,
        leadId: params.leadId,
        type: "EARN",
        stars: quantity,
        source: "CAMPAIGN_RECEIPT",
        sourceId: receipt.id,
        itemsSnapshot: { purchase: campaign.name, amount: totalCents / 100, items: [] },
        actorType: SYSTEM_ACTOR.type,
        actorName: SYSTEM_ACTOR.name,
        expiresAt: program.starsExpireDays ? new Date(Date.now() + program.starsExpireDays * 24 * 60 * 60 * 1000) : null,
      },
    });
  }
  return { receiptId: receipt.id, codes, carryOverCents };
}
