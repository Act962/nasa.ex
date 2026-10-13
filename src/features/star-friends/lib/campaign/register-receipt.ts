import "server-only";
import { createHash, randomInt } from "node:crypto";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { readAttachmentBytes } from "@/features/payment/server/documents/read-attachment-bytes";
import { SYSTEM_ACTOR } from "../actor";
import { auditLoyaltyAction } from "../audit";
import { getActiveProgram } from "../program";
import {
  buildReceiptFingerprint,
  computeLuckyNumbers,
  formatLuckyCode,
  isIssuerAccepted,
  onlyDigits,
  receiptFlagsOf,
  toAccessKey,
} from "../../utils/campaign";
import type { ActiveCampaign } from "./campaign";
import { extractReceipt } from "./extract-receipt";

// Registro de um cupom da campanha (spec 0102, RF-5 a RF-9). A ordem importa: o que dá para
// recusar sem IA (repetição do arquivo, limite do dia) é conferido antes de gastar leitura.

export type RegisterReceiptResult =
  | { outcome: "accepted"; codes: string[]; totalCents: number; carryOverCents: number; isFlagged: boolean }
  | { outcome: "duplicate" }
  | { outcome: "rejected"; reason: "unreadable" | "wrong_issuer" | "out_of_period" }
  | { outcome: "daily_limit" }
  | { outcome: "file_missing" }
  | { outcome: "try_later" }
  | { outcome: "already_processed" };

type ReceiptMessage = { id: string; fileKey: string | null; mimetype: string | null };

const MAX_COMMIT_ATTEMPTS = 3;
const LUCKY_CODE_SPACE = 1_000_000;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toIssuedDate(issuedAt: string | null): Date | null {
  if (!issuedAt) return null;
  // O horário impresso no cupom é o de Brasília.
  const parsed = new Date(`${issuedAt.length === 10 ? `${issuedAt}T00:00` : issuedAt}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

async function findAcceptedDuplicate(campaignId: string, keys: { fileSha256: string; accessKey: string | null; fingerprint: string | null }) {
  const conditions: Prisma.LoyaltyReceiptWhereInput[] = [{ fileSha256: keys.fileSha256 }];
  if (keys.accessKey) conditions.push({ accessKey: keys.accessKey });
  if (keys.fingerprint) conditions.push({ fingerprint: keys.fingerprint });
  return prisma.loyaltyReceipt.findFirst({ where: { campaignId, OR: conditions }, select: { id: true } });
}

export async function registerReceipt(params: {
  organizationId: string;
  campaign: ActiveCampaign;
  memberId: string;
  memberName: string;
  leadId: string;
  trackingId: string;
  message: ReceiptMessage;
}): Promise<RegisterReceiptResult> {
  const { campaign, message } = params;
  const alreadyProcessed = await prisma.loyaltyReceipt.findUnique({ where: { messageId: message.id }, select: { id: true } });
  if (alreadyProcessed) return { outcome: "already_processed" };

  const receiptsToday = await prisma.loyaltyReceipt.count({
    where: { campaignId: campaign.id, memberId: params.memberId, createdAt: { gte: startOfToday() } },
  });
  if (receiptsToday >= campaign.maxReceiptsPerDay) return { outcome: "daily_limit" };

  if (!message.fileKey) return { outcome: "file_missing" };
  const fileBytes = await readAttachmentBytes(message.fileKey).catch(() => null);
  if (!fileBytes || fileBytes.byteLength === 0) return { outcome: "file_missing" };

  const fileSha256 = createHash("sha256").update(fileBytes).digest("hex");
  const baseData = {
    organizationId: params.organizationId,
    campaignId: campaign.id,
    memberId: params.memberId,
    leadId: params.leadId,
    messageId: message.id,
    fileKey: message.fileKey,
    mimetype: message.mimetype,
    fileSize: fileBytes.byteLength,
  };
  const recordDuplicate = async (duplicateOfId: string, rawExtraction?: Prisma.InputJsonValue) => {
    await prisma.loyaltyReceipt.create({
      data: { ...baseData, status: "DUPLICATE", duplicateOfId, rejectReason: "Cupom já cadastrado", rawExtraction: { fileSha256, ...(rawExtraction as object | undefined) } },
    });
    return { outcome: "duplicate" as const };
  };

  const sameFile = await findAcceptedDuplicate(campaign.id, { fileSha256, accessKey: null, fingerprint: null });
  if (sameFile) return recordDuplicate(sameFile.id);

  const extracted = await extractReceipt({
    organizationId: params.organizationId,
    leadId: params.leadId,
    trackingId: params.trackingId,
    fileBytes,
    mimetype: message.mimetype ?? "image/jpeg",
  });
  if (!extracted.ok) return { outcome: extracted.reason === "unsupported" ? "file_missing" : "try_later" };

  const { reading, rawExtraction } = extracted;
  const reject = async (reason: "unreadable" | "wrong_issuer" | "out_of_period", rejectReason: string) => {
    await prisma.loyaltyReceipt.create({ data: { ...baseData, status: "REJECTED", rejectReason, rawExtraction: { fileSha256, ...rawExtraction } } });
    return { outcome: "rejected" as const, reason };
  };
  if (!extracted.isReceipt || reading.totalCents === null || reading.totalCents <= 0) {
    return reject("unreadable", "Não foi possível ler o valor do cupom");
  }
  if (!isIssuerAccepted(reading.issuerDocument, campaign.issuerDocuments)) {
    return reject("wrong_issuer", "Cupom de outro estabelecimento");
  }
  const issuedAt = toIssuedDate(reading.issuedAt);
  if (issuedAt && (issuedAt < campaign.startsAt || issuedAt > campaign.endsAt)) {
    return reject("out_of_period", "Compra fora do período da campanha");
  }

  const totalCents = reading.totalCents;
  const accessKey = toAccessKey(reading.accessKey);
  const fingerprint = buildReceiptFingerprint(reading);
  const flagReasons = receiptFlagsOf(reading);
  const program = await getActiveProgram(params.organizationId);

  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt++) {
    // Reentrega do webhook que chegou durante a leitura: a outra execução já gravou esta mensagem.
    const wasSavedMeanwhile = await prisma.loyaltyReceipt.findUnique({ where: { messageId: message.id }, select: { id: true } });
    if (wasSavedMeanwhile) return { outcome: "already_processed" };
    const duplicate = await findAcceptedDuplicate(campaign.id, { fileSha256, accessKey, fingerprint });
    if (duplicate) return recordDuplicate(duplicate.id, rawExtraction);
    try {
      const committed = await prisma.$transaction(async (tx) => {
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

        const receipt = await tx.loyaltyReceipt.create({
          data: {
            ...baseData,
            fileSha256,
            accessKey,
            fingerprint,
            issuerDocument: onlyDigits(reading.issuerDocument) || null,
            receiptNumber: onlyDigits(reading.receiptNumber) || null,
            issuedAt,
            totalCents,
            status: "ACCEPTED",
            isFlagged: flagReasons.length > 0,
            flagReasons,
            numbersAwarded: quantity,
            rawExtraction,
          },
          select: { id: true },
        });
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
      });

      await auditLoyaltyAction({
        organizationId: params.organizationId,
        actor: SYSTEM_ACTOR,
        action: "campaign.receipt_accepted",
        actionLabel: `${campaign.name}: cupom de ${params.memberName} aceito, ${committed.codes.length} número(s) da sorte`,
        leadId: params.leadId,
        resourceId: committed.receiptId,
        metadata: { campaignId: campaign.id, totalCents, numbers: committed.codes.length, isFlagged: flagReasons.length > 0 },
      });
      return { outcome: "accepted", codes: committed.codes, totalCents, carryOverCents: committed.carryOverCents, isFlagged: flagReasons.length > 0 };
    } catch (error) {
      // Corrida: outro envio gravou o mesmo cupom ou o mesmo código. A próxima volta confere de novo.
      const isUniqueConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isUniqueConflict || attempt === MAX_COMMIT_ATTEMPTS) throw error;
    }
  }
  return { outcome: "try_later" };
}
