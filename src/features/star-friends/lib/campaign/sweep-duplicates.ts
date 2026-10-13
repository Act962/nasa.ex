import "server-only";
import prisma from "@/lib/prisma";
import type { LoyaltyActor } from "../actor";
import { auditLoyaltyAction } from "../audit";
import { findReceiptsToVoid } from "../../utils/campaign";

// Varredura antes do sorteio (spec 0102, RF-10). O bloqueio na hora só pega repetição exata; aqui
// entram os cupons que passaram com leitura incompleta. O mais antigo de cada grupo fica, os
// demais são anulados junto com os números que renderam.

const VOID_REASON_DUPLICATE = "Cupom repetido encontrado na varredura";
const VOID_REASON_EXCESS = "Número acima do total de compras válidas após a varredura";

export async function sweepCampaignDuplicates(params: { organizationId: string; campaignId: string; actor: LoyaltyActor }) {
  const campaign = await prisma.loyaltyCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.organizationId },
    select: { id: true, name: true, amountPerNumberCents: true, drawnAt: true },
  });
  if (!campaign) return { ok: false as const, reason: "not_found" as const };
  if (campaign.drawnAt) return { ok: false as const, reason: "already_drawn" as const };

  const sweptAt = new Date();
  const swept = await prisma.$transaction(async (tx) => {
    // Primeira escrita, para travar a linha da campanha: a aprovação de cupom em conferência trava a
    // mesma linha, então a lista abaixo já inclui o cupom aprovado, ou a aprovação zera esta marca depois.
    await tx.loyaltyCampaign.update({ where: { id: campaign.id }, data: { lastSweepAt: sweptAt } });
    const receipts = await tx.loyaltyReceipt.findMany({
      where: { campaignId: campaign.id, status: "ACCEPTED", createdAt: { lte: sweptAt } },
      orderBy: { createdAt: "asc" },
      select: { id: true, memberId: true, issuerDocument: true, receiptNumber: true, issuedAt: true, totalCents: true, numbersAwarded: true },
    });
    const duplicateOfByReceipt = findReceiptsToVoid(receipts);
    const voidedReceipts = receipts.filter((receipt) => duplicateOfByReceipt.has(receipt.id));
    const affectedMemberIds = [...new Set(voidedReceipts.map((receipt) => receipt.memberId))];
    let voidedCount = 0;
    for (const receipt of voidedReceipts) {
      await tx.loyaltyReceipt.update({
        where: { id: receipt.id },
        data: { status: "VOIDED", duplicateOfId: duplicateOfByReceipt.get(receipt.id), rejectReason: VOID_REASON_DUPLICATE },
      });
      const voided = await tx.loyaltyLuckyNumber.updateMany({
        where: { receiptId: receipt.id, status: "VALID" },
        data: { status: "VOIDED", voidReason: VOID_REASON_DUPLICATE },
      });
      voidedCount += voided.count;
      await tx.loyaltyCampaignEntry.update({
        where: { campaignId_memberId: { campaignId: campaign.id, memberId: receipt.memberId } },
        data: { totalSpentCents: { decrement: receipt.totalCents ?? 0 } },
      });
    }
    // Sem o cupom anulado, a sobra muda: o cliente não pode ficar com mais números do que as compras válidas dão.
    for (const memberId of affectedMemberIds) {
      const entry = await tx.loyaltyCampaignEntry.findUnique({
        where: { campaignId_memberId: { campaignId: campaign.id, memberId } },
        select: { id: true, totalSpentCents: true },
      });
      if (!entry) continue;
      const validTotalCents = Math.max(0, entry.totalSpentCents);
      const entitledNumbers = Math.floor(validTotalCents / campaign.amountPerNumberCents);
      const validNumbers = await tx.loyaltyLuckyNumber.findMany({
        where: { campaignId: campaign.id, memberId, status: "VALID" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      const excessIds = validNumbers.slice(0, Math.max(0, validNumbers.length - entitledNumbers)).map((luckyNumber) => luckyNumber.id);
      if (excessIds.length > 0) {
        await tx.loyaltyLuckyNumber.updateMany({ where: { id: { in: excessIds } }, data: { status: "VOIDED", voidReason: VOID_REASON_EXCESS } });
        voidedCount += excessIds.length;
      }
      await tx.loyaltyCampaignEntry.update({
        where: { id: entry.id },
        data: { totalSpentCents: validTotalCents, carryOverCents: validTotalCents % campaign.amountPerNumberCents },
      });
    }
    return { receiptsChecked: receipts.length, receiptsVoided: voidedReceipts.length, numbersVoided: voidedCount };
  });

  await auditLoyaltyAction({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "campaign.sweep",
    actionLabel: `${campaign.name}: varredura anulou ${swept.receiptsVoided} cupom(ns) e ${swept.numbersVoided} número(s)`,
    resourceId: campaign.id,
    metadata: swept,
  });
  return { ok: true as const, ...swept };
}
