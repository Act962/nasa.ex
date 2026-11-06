import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { LoyaltyActor } from "../actor";
import { auditLoyaltyAction } from "../audit";
import { getActiveProgram } from "../program";
import { buildReceiptFingerprint, formatCents, onlyDigits, parseIssuedAt, toBrasiliaDay } from "../../utils/campaign";
import { grantLuckyNumbers } from "./grant-lucky-numbers";

// Ajustes manuais de números da sorte (spec 0134, RF-8 e RF-9): lançar um cupom pela tela, com as
// mesmas regras do cupom do WhatsApp, e anular um cupom aceito (ex.: nota que não foi paga),
// estornando as stars que ele rendeu.

type ManualReceiptFailure = "not_found" | "not_participant" | "draw_in_progress" | "out_of_period" | "duplicate";
type VoidReceiptFailure = "not_found" | "not_accepted" | "receipt_has_winner";

class VoidAbort extends Error {
  constructor(readonly reason: VoidReceiptFailure) {
    super(reason);
  }
}

async function hasActiveDraws(campaignId: string): Promise<boolean> {
  const activeDraw = await prisma.loyaltyCampaignDraw.findFirst({ where: { campaignId, revokedAt: null }, select: { id: true } });
  return Boolean(activeDraw);
}

export async function registerManualReceipt(params: {
  organizationId: string;
  campaignId: string;
  memberId: string;
  totalCents: number;
  issuedOn: string | null;
  receiptNumber: string | null;
  reason: string;
  actor: LoyaltyActor;
}) {
  const campaign = await prisma.loyaltyCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.organizationId },
    select: { id: true, name: true, amountPerNumberCents: true, startsAt: true, endsAt: true, drawnAt: true, issuerDocuments: true },
  });
  if (!campaign) return { ok: false as const, reason: "not_found" as ManualReceiptFailure };
  // Número novo no meio do sorteio mudaria a chance de quem ainda concorre.
  if (campaign.drawnAt || (await hasActiveDraws(campaign.id))) return { ok: false as const, reason: "draw_in_progress" as ManualReceiptFailure };

  const entry = await prisma.loyaltyCampaignEntry.findUnique({
    where: { campaignId_memberId: { campaignId: campaign.id, memberId: params.memberId } },
    select: { member: { select: { name: true, lastLeadId: true } } },
  });
  if (!entry) return { ok: false as const, reason: "not_participant" as ManualReceiptFailure };

  const issuedAt = params.issuedOn ? parseIssuedAt(params.issuedOn) : null;
  if (issuedAt && (issuedAt < campaign.startsAt || issuedAt > campaign.endsAt)) return { ok: false as const, reason: "out_of_period" as ManualReceiptFailure };

  // Com uma loja só na campanha, o CNPJ é o dela: assim o cupom lançado à mão também é barrado como repetido.
  const issuerDocument = campaign.issuerDocuments.length === 1 ? campaign.issuerDocuments[0] : null;
  const receiptNumber = onlyDigits(params.receiptNumber) || null;
  const fingerprint = buildReceiptFingerprint({
    issuerDocument,
    receiptNumber,
    accessKey: null,
    issuedAt: issuedAt ? toBrasiliaDay(issuedAt) : null,
    totalCents: params.totalCents,
    isFiscal: true,
    confidence: 1,
  });
  if (fingerprint) {
    const duplicate = await prisma.loyaltyReceipt.findFirst({ where: { campaignId: campaign.id, fingerprint }, select: { id: true } });
    if (duplicate) return { ok: false as const, reason: "duplicate" as ManualReceiptFailure };
  }
  const program = await getActiveProgram(params.organizationId);
  const flagReason = `Lançado manualmente por ${params.actor.name}: ${params.reason}`;

  let granted: { receiptId: string; codes: string[]; carryOverCents: number };
  try {
    granted = await prisma.$transaction(async (tx) => {
      // Mesma trava da aprovação na conferência: o cupom novo exige outra varredura antes do sorteio.
      await tx.loyaltyCampaign.update({ where: { id: campaign.id }, data: { lastSweepAt: null } });
      return grantLuckyNumbers(tx, {
        organizationId: params.organizationId,
        campaign,
        memberId: params.memberId,
        leadId: entry.member.lastLeadId,
        totalCents: params.totalCents,
        program,
        saveReceipt: (numbersAwarded) =>
          tx.loyaltyReceipt.create({
            data: {
              organizationId: params.organizationId,
              campaignId: campaign.id,
              memberId: params.memberId,
              leadId: entry.member.lastLeadId,
              messageId: `manual:${randomUUID()}`,
              status: "ACCEPTED",
              issuerDocument,
              receiptNumber,
              issuedAt,
              totalCents: params.totalCents,
              fingerprint,
              numbersAwarded,
              isFlagged: true,
              flagReasons: [flagReason],
            },
            select: { id: true },
          }),
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false as const, reason: "duplicate" as ManualReceiptFailure };
    throw error;
  }

  await auditLoyaltyAction({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "campaign.receipt_manual",
    actionLabel: `${campaign.name}: cupom de ${formatCents(params.totalCents)} lançado à mão para ${entry.member.name}, ${granted.codes.length} número(s). Motivo: ${params.reason}`,
    leadId: entry.member.lastLeadId,
    resourceId: granted.receiptId,
    metadata: { numbers: granted.codes.length, totalCents: params.totalCents },
  });
  return { ok: true as const, codes: granted.codes, carryOverCents: granted.carryOverCents };
}

export async function voidAcceptedReceipt(params: { organizationId: string; receiptId: string; reason: string; actor: LoyaltyActor }) {
  const receipt = await prisma.loyaltyReceipt.findFirst({
    where: { id: params.receiptId, organizationId: params.organizationId },
    select: {
      id: true,
      status: true,
      memberId: true,
      leadId: true,
      totalCents: true,
      member: { select: { name: true } },
      campaign: { select: { id: true, name: true, amountPerNumberCents: true } },
    },
  });
  if (!receipt) return { ok: false as const, reason: "not_found" as VoidReceiptFailure };
  if (receipt.status !== "ACCEPTED") return { ok: false as const, reason: "not_accepted" as VoidReceiptFailure };
  const { campaign } = receipt;

  try {
    const voided = await prisma.$transaction(async (tx) => {
      // Trava a linha da campanha: sorteio e varredura não leem os números no meio da anulação.
      await tx.loyaltyCampaign.update({ where: { id: campaign.id }, data: { updatedAt: new Date() } });
      const winningNumber = await tx.loyaltyLuckyNumber.findFirst({ where: { receiptId: receipt.id, drawPosition: { not: null } }, select: { id: true } });
      if (winningNumber) throw new VoidAbort("receipt_has_winner");
      const claimed = await tx.loyaltyReceipt.updateMany({
        where: { id: receipt.id, status: "ACCEPTED" },
        data: { status: "VOIDED", rejectReason: params.reason },
      });
      if (claimed.count === 0) throw new VoidAbort("not_accepted");
      const receiptNumbers = await tx.loyaltyLuckyNumber.updateMany({
        where: { receiptId: receipt.id, status: "VALID" },
        data: { status: "VOIDED", voidReason: params.reason },
      });

      // Sem este valor, a sobra que ele deixou pode ter ajudado a formar números de outros cupons.
      const entry = await tx.loyaltyCampaignEntry.update({
        where: { campaignId_memberId: { campaignId: campaign.id, memberId: receipt.memberId } },
        data: { totalSpentCents: { decrement: receipt.totalCents ?? 0 } },
        select: { id: true, totalSpentCents: true },
      });
      const validTotalCents = Math.max(0, entry.totalSpentCents);
      const entitledNumbers = Math.floor(validTotalCents / campaign.amountPerNumberCents);
      const remainingNumbers = await tx.loyaltyLuckyNumber.findMany({
        where: { campaignId: campaign.id, memberId: receipt.memberId, status: "VALID" },
        orderBy: [{ drawPosition: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
        select: { id: true, drawPosition: true },
      });
      const excessIds = remainingNumbers
        .filter((luckyNumber) => luckyNumber.drawPosition === null)
        .slice(0, Math.max(0, remainingNumbers.length - entitledNumbers))
        .map((luckyNumber) => luckyNumber.id);
      if (excessIds.length > 0) {
        await tx.loyaltyLuckyNumber.updateMany({ where: { id: { in: excessIds } }, data: { status: "VOIDED", voidReason: params.reason } });
      }
      await tx.loyaltyCampaignEntry.update({
        where: { id: entry.id },
        data: { totalSpentCents: validTotalCents, carryOverCents: validTotalCents % campaign.amountPerNumberCents },
      });

      const numbersVoided = receiptNumbers.count + excessIds.length;
      const earned = await tx.loyaltyLedgerEntry.findFirst({
        where: { source: "CAMPAIGN_RECEIPT", sourceId: receipt.id, type: "EARN" },
        select: { organizationId: true, expiresAt: true },
      });
      let starsReversed = 0;
      if (earned && numbersVoided > 0) {
        starsReversed = numbersVoided;
        await tx.loyaltyLedgerEntry.create({
          data: {
            organizationId: params.organizationId,
            memberId: receipt.memberId,
            leadId: receipt.leadId,
            type: "REVERSAL",
            stars: -starsReversed,
            source: "CAMPAIGN_RECEIPT",
            sourceId: receipt.id,
            reason: `Cupom anulado: ${params.reason}`,
            actorType: params.actor.type,
            actorUserId: params.actor.userId,
            actorName: params.actor.name,
          },
        });
      }
      return { numbersVoided, starsReversed };
    });

    await auditLoyaltyAction({
      organizationId: params.organizationId,
      actor: params.actor,
      action: "campaign.receipt_voided",
      actionLabel: `${campaign.name}: cupom${receipt.totalCents !== null ? ` de ${formatCents(receipt.totalCents)}` : ""} de ${receipt.member.name} anulado, ${voided.numbersVoided} número(s) e ${voided.starsReversed} star(s) estornadas. Motivo: ${params.reason}`,
      leadId: receipt.leadId,
      resourceId: receipt.id,
      metadata: voided,
    });
    return { ok: true as const, ...voided };
  } catch (error) {
    if (error instanceof VoidAbort) return { ok: false as const, reason: error.reason };
    throw error;
  }
}
