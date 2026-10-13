import "server-only";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { deliverTextToLead } from "@/features/nerp-catalog/lib/order-channel";
import { isFreeFormWindowOpen } from "@/features/tracking-chat/lib/providers/automated-outbound";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import type { LoyaltyActor } from "../actor";
import { auditLoyaltyAction } from "../audit";
import { getActiveProgram } from "../program";
import { buildReceiptFingerprint, formatCents, onlyDigits, parseIssuedAt, toBrasiliaDay } from "../../utils/campaign";
import { grantLuckyNumbers } from "./grant-lucky-numbers";

// Conferência manual do cupom que a leitura automática não resolveu (spec 0102, RF-15). Quem
// aprova informa o valor; o cálculo dos números, o bloqueio de repetido e o período seguem os
// mesmos do cupom aceito na hora.

const DEFAULT_REJECT_REASON = "Recusado na conferência";
// O texto do WhatsApp tem limite de tamanho, e um cupom alto rende centenas de números.
const MAX_CODES_IN_MESSAGE = 60;

type ReviewFailure = "not_found" | "not_pending" | "already_drawn" | "out_of_period" | "duplicate";

export type ReviewReceiptResult =
  | { ok: true; decision: "approved"; codes: string[]; carryOverCents: number; wasCustomerNotified: boolean }
  | { ok: true; decision: "rejected"; wasCustomerNotified: boolean }
  | { ok: false; reason: ReviewFailure };

class ReceiptAlreadyReviewedError extends Error {}

/** Aviso na conversa, só com a janela de 24 h aberta: fora dela a Meta exige modelo aprovado. Devolve se enviou. */
async function notifyCustomer(leadId: string | null, text: string): Promise<boolean> {
  if (!leadId) return false;
  try {
    const conversation = await prisma.conversation.findFirst({ where: { leadId }, select: { id: true, trackingId: true } });
    if (!conversation) return false;
    const resolved = await resolveOutboundProvider(conversation.trackingId);
    if (!(await isFreeFormWindowOpen(resolved, conversation.id))) return false;
    await deliverTextToLead({
      conversationId: conversation.id,
      senderName: "STAR FRIENDS",
      text,
      metadata: { kind: "star_friends_campaign_review" },
    });
    return true;
  } catch (error) {
    console.error("[star-friends] notify_receipt_review_failed", error);
    return false;
  }
}

async function findPendingReceipt(organizationId: string, receiptId: string) {
  return prisma.loyaltyReceipt.findFirst({
    where: { id: receiptId, organizationId },
    select: {
      id: true,
      status: true,
      memberId: true,
      leadId: true,
      issuerDocument: true,
      receiptNumber: true,
      issuedAt: true,
      member: { select: { name: true } },
      campaign: { select: { id: true, name: true, amountPerNumberCents: true, startsAt: true, endsAt: true, drawnAt: true } },
    },
  });
}

export async function approveReceipt(params: {
  organizationId: string;
  receiptId: string;
  totalCents: number;
  issuedOn: string | null;
  receiptNumber: string | null;
  actor: LoyaltyActor;
}): Promise<ReviewReceiptResult> {
  const receipt = await findPendingReceipt(params.organizationId, params.receiptId);
  if (!receipt) return { ok: false, reason: "not_found" };
  if (receipt.status !== "PENDING_REVIEW") return { ok: false, reason: "not_pending" };
  const { campaign } = receipt;
  if (campaign.drawnAt) return { ok: false, reason: "already_drawn" };

  const issuedAt = params.issuedOn ? parseIssuedAt(params.issuedOn) : receipt.issuedAt;
  if (issuedAt && (issuedAt < campaign.startsAt || issuedAt > campaign.endsAt)) return { ok: false, reason: "out_of_period" };

  const { totalCents } = params;
  const receiptNumber = onlyDigits(params.receiptNumber) || receipt.receiptNumber;
  const fingerprint = buildReceiptFingerprint({
    issuerDocument: receipt.issuerDocument,
    receiptNumber,
    accessKey: null,
    issuedAt: issuedAt ? toBrasiliaDay(issuedAt) : null,
    totalCents,
    isFiscal: true,
    confidence: 1,
  });
  if (fingerprint) {
    const duplicate = await prisma.loyaltyReceipt.findFirst({
      where: { campaignId: campaign.id, fingerprint, id: { not: receipt.id } },
      select: { id: true },
    });
    if (duplicate) return { ok: false, reason: "duplicate" };
  }
  const program = await getActiveProgram(params.organizationId);

  let granted: { codes: string[]; carryOverCents: number };
  try {
    granted = await prisma.$transaction(async (tx) => {
      // Primeira escrita, para travar a linha da campanha: a varredura trava a mesma linha antes de
      // ler os cupons, então ou ela já enxerga este cupom aceito, ou termina antes e a marca é
      // zerada aqui. Sem isso a varredura podia regravar a marca por cima e o sorteio aceitaria um
      // cupom que ela não viu.
      await tx.loyaltyCampaign.update({ where: { id: campaign.id }, data: { lastSweepAt: null } });
      // Dois cliques em "Aprovar": só o primeiro encontra o cupom ainda em conferência.
      const claimed = await tx.loyaltyReceipt.updateMany({ where: { id: receipt.id, status: "PENDING_REVIEW" }, data: { status: "ACCEPTED" } });
      if (claimed.count === 0) throw new ReceiptAlreadyReviewedError();
      const result = await grantLuckyNumbers(tx, {
        organizationId: params.organizationId,
        campaign,
        memberId: receipt.memberId,
        leadId: receipt.leadId,
        totalCents,
        program,
        saveReceipt: (numbersAwarded) =>
          tx.loyaltyReceipt.update({
            where: { id: receipt.id },
            data: { totalCents, issuedAt, receiptNumber, fingerprint, numbersAwarded, isFlagged: false, flagReasons: [] },
            select: { id: true },
          }),
      });
      return result;
    });
  } catch (error) {
    if (error instanceof ReceiptAlreadyReviewedError) return { ok: false, reason: "not_pending" };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, reason: "duplicate" };
    throw error;
  }

  await auditLoyaltyAction({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "campaign.receipt_approved",
    actionLabel: `${campaign.name}: cupom de ${receipt.member.name} aprovado na conferência, ${granted.codes.length} número(s) da sorte`,
    leadId: receipt.leadId,
    resourceId: receipt.id,
    metadata: { campaignId: campaign.id, totalCents, numbers: granted.codes.length },
  });

  const perNumber = formatCents(campaign.amountPerNumberCents);
  const carryLine = `Saldo acumulado para o próximo número: ${formatCents(granted.carryOverCents)} de ${perNumber}.`;
  const shownCodes = granted.codes.slice(0, MAX_CODES_IN_MESSAGE);
  const hiddenLine = granted.codes.length > shownCodes.length ? `\n… e mais ${granted.codes.length - shownCodes.length}, em "Ver meus códigos".` : "";
  const codesBlock =
    granted.codes.length === 0
      ? `Ele ainda não completou ${perNumber}, então o valor ficou guardado.`
      : `${granted.codes.length === 1 ? "Seu número da sorte" : `Seus ${granted.codes.length} números da sorte`}:\n${shownCodes.map((code) => `🎟️ ${code}`).join("\n")}${hiddenLine}`;
  const wasCustomerNotified = await notifyCustomer(
    receipt.leadId,
    `Seu cupom de ${formatCents(totalCents)} foi conferido e aprovado. ✅\n\n${codesBlock}\n\n${carryLine}`,
  );
  return { ok: true, decision: "approved", codes: granted.codes, carryOverCents: granted.carryOverCents, wasCustomerNotified };
}

export async function rejectReceipt(params: {
  organizationId: string;
  receiptId: string;
  rejectReason: string | null;
  actor: LoyaltyActor;
}): Promise<ReviewReceiptResult> {
  const receipt = await findPendingReceipt(params.organizationId, params.receiptId);
  if (!receipt) return { ok: false, reason: "not_found" };
  const rejectReason = params.rejectReason?.trim() || null;
  // O arquivo deixa de travar: o cliente pode mandar a mesma foto de novo, se for o caso.
  const rejected = await prisma.loyaltyReceipt.updateMany({
    where: { id: receipt.id, status: "PENDING_REVIEW" },
    data: { status: "REJECTED", rejectReason: rejectReason ?? DEFAULT_REJECT_REASON, fileSha256: null, isFlagged: false },
  });
  if (rejected.count === 0) return { ok: false, reason: "not_pending" };

  await auditLoyaltyAction({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "campaign.receipt_rejected",
    actionLabel: `${receipt.campaign.name}: cupom de ${receipt.member.name} recusado na conferência`,
    leadId: receipt.leadId,
    resourceId: receipt.id,
    metadata: { campaignId: receipt.campaign.id, rejectReason },
  });
  const wasCustomerNotified = await notifyCustomer(
    receipt.leadId,
    `Seu cupom não foi aprovado na conferência${rejectReason ? `: ${rejectReason}` : ""}. Se quiser, envie outra foto do cupom, inteiro e bem iluminado.`,
  );
  return { ok: true, decision: "rejected", wasCustomerNotified };
}
