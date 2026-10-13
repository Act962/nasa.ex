import "server-only";
import { createHash } from "node:crypto";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { readAttachmentBytes } from "@/features/payment/server/documents/read-attachment-bytes";
import { SYSTEM_ACTOR } from "../actor";
import { auditLoyaltyAction } from "../audit";
import { getActiveProgram } from "../program";
import {
  RECEIPT_FLAGS,
  buildReceiptFingerprint,
  correctMisreadYear,
  isIssuerAccepted,
  onlyDigits,
  parseIssuedAt,
  receiptFlagsOf,
  startOfBrasiliaDay,
  toAccessKey,
  toValidCnpj,
} from "../../utils/campaign";
import type { ActiveCampaign } from "./campaign";
import { extractReceipt } from "./extract-receipt";
import { grantLuckyNumbers } from "./grant-lucky-numbers";

// Registro de um cupom da campanha (spec 0102, RF-5 a RF-9). A ordem importa: o que dá para
// recusar sem IA (repetição do arquivo, limite do dia) é conferido antes de gastar leitura.

type RejectReason = "unreadable" | "not_a_receipt" | "wrong_issuer" | "out_of_period";

export type StoredReceiptResult =
  | { outcome: "accepted"; codes: string[]; totalCents: number; carryOverCents: number; isFlagged: boolean }
  | { outcome: "duplicate" }
  | { outcome: "rejected"; reason: RejectReason }
  // A leitura automática não resolveu: o cupom espera a conferência da equipe (RF-15).
  | { outcome: "pending_review" };

export type RegisterReceiptResult =
  | StoredReceiptResult
  | { outcome: "daily_limit" }
  | { outcome: "file_missing" }
  | { outcome: "try_later" }
  // `stored` é o que foi decidido na primeira vez, para a resposta poder ser refeita se o envio falhou.
  | { outcome: "already_processed"; stored: StoredReceiptResult };

type ReceiptMessage = { id: string; fileKey: string | null; mimetype: string | null };

const MAX_COMMIT_ATTEMPTS = 3;
type ReviewReadData = Pick<Prisma.LoyaltyReceiptUncheckedCreateInput, "issuerDocument" | "receiptNumber" | "issuedAt" | "rawExtraction">;
// O limite do dia conta cupons aceitos. Este teto conta toda tentativa, e existe só para um
// cliente não gastar leituras por IA sem parar com fotos que nunca passam.
const ATTEMPTS_PER_ALLOWED_RECEIPT = 4;
const REJECT_LABELS: Record<RejectReason, string> = {
  unreadable: "Não foi possível ler o valor do cupom",
  not_a_receipt: "A imagem não é um cupom de compra",
  wrong_issuer: "Cupom de outro estabelecimento",
  out_of_period: "Compra fora do período da campanha",
};

async function findProcessedReceipt(messageId: string): Promise<StoredReceiptResult | null> {
  const receipt = await prisma.loyaltyReceipt.findUnique({
    where: { messageId },
    select: {
      status: true,
      rejectReason: true,
      totalCents: true,
      isFlagged: true,
      campaignId: true,
      memberId: true,
      luckyNumbers: { orderBy: { createdAt: "asc" }, select: { code: true } },
    },
  });
  if (!receipt) return null;
  if (receipt.status === "DUPLICATE") return { outcome: "duplicate" };
  if (receipt.status === "PENDING_REVIEW") return { outcome: "pending_review" };
  if (receipt.status === "REJECTED") {
    const reason = (Object.keys(REJECT_LABELS) as RejectReason[]).find((candidate) => REJECT_LABELS[candidate] === receipt.rejectReason);
    return { outcome: "rejected", reason: reason ?? "unreadable" };
  }
  const entry = await prisma.loyaltyCampaignEntry.findUnique({
    where: { campaignId_memberId: { campaignId: receipt.campaignId, memberId: receipt.memberId } },
    select: { carryOverCents: true },
  });
  return {
    outcome: "accepted",
    codes: receipt.luckyNumbers.map((luckyNumber) => luckyNumber.code),
    totalCents: receipt.totalCents ?? 0,
    carryOverCents: entry?.carryOverCents ?? 0,
    isFlagged: receipt.isFlagged,
  };
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
  const alreadyProcessed = await findProcessedReceipt(message.id);
  if (alreadyProcessed) return { outcome: "already_processed", stored: alreadyProcessed };

  const sentToday = { campaignId: campaign.id, memberId: params.memberId, createdAt: { gte: startOfBrasiliaDay(new Date()) } };
  const [acceptedToday, attemptsToday] = await Promise.all([
    prisma.loyaltyReceipt.count({ where: { ...sentToday, status: { in: ["ACCEPTED", "VOIDED", "PENDING_REVIEW"] } } }),
    prisma.loyaltyReceipt.count({ where: sentToday }),
  ]);
  if (acceptedToday >= campaign.maxReceiptsPerDay || attemptsToday >= campaign.maxReceiptsPerDay * ATTEMPTS_PER_ALLOWED_RECEIPT) {
    return { outcome: "daily_limit" };
  }

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
  // Em conferência o arquivo já fica travado: reenviar a mesma foto não abre outra conferência.
  const holdForReview = async (reviewReason: string, readData: ReviewReadData | null) => {
    try {
      await prisma.loyaltyReceipt.create({
        data: { ...baseData, ...readData, fileSha256, status: "PENDING_REVIEW", isFlagged: true, flagReasons: [reviewReason] },
      });
    } catch (error) {
      const isUniqueConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isUniqueConflict) throw error;
      const savedMeanwhile = await findProcessedReceipt(message.id);
      return savedMeanwhile ? { outcome: "already_processed" as const, stored: savedMeanwhile } : { outcome: "duplicate" as const };
    }
    return { outcome: "pending_review" as const };
  };
  if (!extracted.ok) {
    if (extracted.reason === "unsupported") return { outcome: "file_missing" };
    return holdForReview(RECEIPT_FLAGS.readerUnavailable, null);
  }

  const { rawExtraction } = extracted;
  const readIssuedAt = parseIssuedAt(extracted.reading.issuedAt);
  const correctedIssuedAt = readIssuedAt ? correctMisreadYear(readIssuedAt, campaign) : null;
  const issuedAt = correctedIssuedAt ? parseIssuedAt(correctedIssuedAt) : readIssuedAt;
  // Data que não deu para interpretar conta como não lida: o cupom entra com alerta, em vez de passar sem a conferência do período.
  const reading = {
    ...extracted.reading,
    issuedAt: issuedAt ? (correctedIssuedAt ?? extracted.reading.issuedAt) : null,
    issuerDocument: toValidCnpj(extracted.reading.issuerDocument),
  };
  const reject = async (reason: RejectReason) => {
    await prisma.loyaltyReceipt.create({
      data: { ...baseData, status: "REJECTED", rejectReason: REJECT_LABELS[reason], rawExtraction: { fileSha256, ...rawExtraction } },
    });
    return { outcome: "rejected" as const, reason };
  };
  if (!extracted.isReceipt) return reject("not_a_receipt");
  if (!isIssuerAccepted(reading.issuerDocument, campaign.issuerDocuments)) {
    return reject("wrong_issuer");
  }
  if (issuedAt && (issuedAt < campaign.startsAt || issuedAt > campaign.endsAt)) {
    return reject("out_of_period");
  }
  // Sem o valor não há como calcular os números: quem confere a foto informa o total.
  if (reading.totalCents === null || reading.totalCents <= 0) {
    return holdForReview(RECEIPT_FLAGS.noTotal, {
      issuerDocument: reading.issuerDocument,
      receiptNumber: onlyDigits(reading.receiptNumber) || null,
      issuedAt,
      rawExtraction,
    });
  }

  const totalCents = reading.totalCents;
  const accessKey = toAccessKey(reading.accessKey);
  const fingerprint = buildReceiptFingerprint(reading);
  const flagReasons = [...receiptFlagsOf(reading), ...(correctedIssuedAt ? [RECEIPT_FLAGS.yearCorrected] : [])];
  const program = await getActiveProgram(params.organizationId);

  for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt++) {
    // Reentrega do webhook que chegou durante a leitura: a outra execução já gravou esta mensagem.
    const wasSavedMeanwhile = await findProcessedReceipt(message.id);
    if (wasSavedMeanwhile) return { outcome: "already_processed", stored: wasSavedMeanwhile };
    const duplicate = await findAcceptedDuplicate(campaign.id, { fileSha256, accessKey, fingerprint });
    if (duplicate) return recordDuplicate(duplicate.id, rawExtraction);
    try {
      const committed = await prisma.$transaction(async (tx) => {
        return grantLuckyNumbers(tx, {
          organizationId: params.organizationId,
          campaign,
          memberId: params.memberId,
          leadId: params.leadId,
          totalCents,
          program,
          saveReceipt: (numbersAwarded) =>
            tx.loyaltyReceipt.create({
              data: {
                ...baseData,
                fileSha256,
                accessKey,
                fingerprint,
                issuerDocument: reading.issuerDocument,
                receiptNumber: onlyDigits(reading.receiptNumber) || null,
                issuedAt,
                totalCents,
                status: "ACCEPTED",
                isFlagged: flagReasons.length > 0,
                flagReasons,
                numbersAwarded,
                rawExtraction,
              },
              select: { id: true },
            }),
        });
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
