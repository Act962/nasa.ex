import "server-only";
import prisma from "@/lib/prisma";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { interruptOf, normalizeAnswer } from "@/features/workflows/lib/conversation-steps";
import { markAwaitingReply } from "@/features/workflows/lib/agent-executors/conversation-steps";
import { flowOriginOf } from "@/features/workflows/lib/flow-origin";
import type { NodeExecutionResult, NodeExecutor } from "@/features/workflows/lib/run-workflow";
import type { WorkflowContext } from "@/features/workflows/lib/workflow-context";
import {
  campaignAvailabilityAt,
  findActiveCampaign,
  findCampaignEntryForLead,
  getMemberCampaignSummary,
  listMemberLuckyCodes,
  registerCampaignEntry,
  type ActiveCampaign,
} from "@/features/star-friends/lib/campaign/campaign";
import { registerReceipt, type RegisterReceiptResult, type StoredReceiptResult } from "@/features/star-friends/lib/campaign/register-receipt";
import { formatCents, isSamePhone } from "@/features/star-friends/utils/campaign";
import { SAYS_NO, SAYS_YES, VALID_NAME, receiptReplyOf } from "@/features/tracking-chat-ai/lib/campaign-handler";
import { getActiveProgram } from "@/features/star-friends/lib/program";
import {
  PROMO_ENROLL_OUTPUTS,
  PROMO_LOOKUP_OUTPUTS,
  PROMO_RECEIPT_OUTPUTS,
  isPhotoOrPdf,
  parsePromoEnroll,
  parsePromoLookup,
  parsePromoReceipt,
} from "../lib/nodes";
import {
  EXPIRED_RESULT,
  MISSING_LEAD,
  failed,
  finishWith,
  leadRefOf,
  readClientReply,
  sendText,
  waitForReply,
  waitingStateOf,
  type LeadRef,
} from "./executors";

// Blocos da promoção STAR FRIENDS no FlowAstro (spec 0140). Cada bloco chama as funções da campanha (spec 0102): a regra
// de dinheiro e sorteio fica num lugar só, e a campanha pela IA do funil não muda (D-4).

const ACCEPT_ID = "promo:accept";
const REFUSE_ID = "promo:refuse";
const MAX_RECEIPTS_PER_STEP = 10;

async function campaignOfLead(ref: LeadRef): Promise<{ organizationId: string; campaign: ActiveCampaign | null }> {
  const tracking = await prisma.tracking.findUniqueOrThrow({ where: { id: ref.trackingId }, select: { organizationId: true } });
  return { organizationId: tracking.organizationId, campaign: await findActiveCampaign(tracking.organizationId, ref.trackingId) };
}

function flowVariable(context: WorkflowContext, name: string): string {
  const value = name ? (context.vars ?? {})[name] : undefined;
  return typeof value === "string" ? value.trim() : "";
}

// ─── Inscrever na promoção ───────────────────────────────────

async function sendRulesQuestion(ref: LeadRef, context: WorkflowContext, nodeId: string, body: string): Promise<void> {
  const { sendButtonsToLead } = await import("@/features/tracking-executions/lib/send-buttons-to-lead");
  await sendButtonsToLead({
    leadId: ref.leadId,
    trackingId: ref.trackingId,
    bodyText: body,
    buttons: [
      { id: ACCEPT_ID, text: "Aceito" },
      { id: REFUSE_ID, text: "Não aceito" },
    ],
    origin: flowOriginOf(context, nodeId),
    forceOfficialInteractive: true,
  });
}

interface EnrollState {
  campaignId: string;
  step: "name" | "consent";
  customerName?: string;
}

function rulesBody(campaign: ActiveCampaign, customerName: string | null): string {
  const rulesLink = campaign.rulesUrl ? `\n\nRegulamento completo: ${campaign.rulesUrl}` : "";
  const greeting = customerName ? `Obrigado, ${customerName}!` : `*${campaign.name}* 🎉`;
  return `${greeting}\n\n${campaign.rulesSummary.trim()}${rulesLink}\n\nVocê aceita as regras da promoção?`;
}

export const promoEnrollExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  const config = parsePromoEnroll(data);
  if (dryRun) return finishWith(PROMO_ENROLL_OUTPUTS.enrolled, { dryRun: true });
  const ref = leadRefOf(context);
  if (!ref) return MISSING_LEAD;
  const timeoutMinutes = config.replyDeadline.timeoutMinutes;
  const waitFor = async (state: EnrollState): Promise<NodeExecutionResult> => {
    await markAwaitingReply({ ...ref, nodeId, timeoutMinutes });
    return waitForReply(state, timeoutMinutes);
  };

  try {
    const { organizationId, campaign } = await campaignOfLead(ref);
    if (!campaign) return finishWith(PROMO_ENROLL_OUTPUTS.closed);
    const { member, entry } = await findCampaignEntryForLead({ organizationId, campaignId: campaign.id, leadId: ref.leadId });
    if (!member) return finishWith(PROMO_ENROLL_OUTPUTS.other, { reason: "lead_without_member" });
    if (entry) return finishWith(PROMO_ENROLL_OUTPUTS.alreadyEnrolled);
    if (campaignAvailabilityAt(campaign, new Date()) !== "open") return finishWith(PROMO_ENROLL_OUTPUTS.closed);

    const waiting = waitingStateOf<EnrollState>(nodeId, context);
    if (!waiting) {
      if (config.nameSource === "ASK") {
        await sendText(ref, context, nodeId, `*${campaign.name}* 🎉\n\nPara participar, me diga o seu *nome completo*.`);
        return waitFor({ campaignId: campaign.id, step: "name" });
      }
      const lead = await prisma.lead.findUnique({ where: { id: ref.leadId }, select: { name: true } });
      const customerName =
        (config.nameSource === "VARIABLE" ? flowVariable(context, config.nameVariable) : "") || lead?.name?.trim() || member.name;
      await sendRulesQuestion(ref, context, nodeId, rulesBody(campaign, null));
      return waitFor({ campaignId: campaign.id, step: "consent", customerName });
    }

    const reply = readClientReply(context);
    if (reply.hasTimedOut) return config.replyDeadline.hasDeadline ? finishWith(PROMO_ENROLL_OUTPUTS.noReply) : EXPIRED_RESULT;
    // A campanha mudou enquanto o cliente respondia: o aceite não vale para a campanha nova.
    if (waiting.campaignId !== campaign.id) return finishWith(PROMO_ENROLL_OUTPUTS.closed);
    const text = reply.text.trim();
    const isInterrupt = interruptOf(text) !== null;

    if (waiting.step === "name") {
      if (reply.clickedId || isInterrupt) return finishWith(PROMO_ENROLL_OUTPUTS.other);
      if (!VALID_NAME.test(text)) {
        await sendText(ref, context, nodeId, "Escreva só o seu nome completo, por favor.");
        return waitFor(waiting);
      }
      await sendRulesQuestion(ref, context, nodeId, rulesBody(campaign, text));
      return waitFor({ campaignId: campaign.id, step: "consent", customerName: text });
    }

    const answer = normalizeAnswer(text);
    const accepts = reply.clickedId === ACCEPT_ID || (!reply.clickedId && SAYS_YES.test(answer));
    const refuses = reply.clickedId === REFUSE_ID || (!reply.clickedId && SAYS_NO.test(answer));
    const consentMetadata = { termsVersion: campaign.rulesVersion, source: "star-friends-campaign", campaignId: campaign.id, via: "flowastro" };

    if (refuses) {
      await trackLeadEvent({ leadId: ref.leadId, kind: "consent_refused", metadata: consentMetadata });
      return finishWith(PROMO_ENROLL_OUTPUTS.refused);
    }
    if (!accepts) {
      if (reply.clickedId || isInterrupt || !answer) return finishWith(PROMO_ENROLL_OUTPUTS.other);
      await sendRulesQuestion(ref, context, nodeId, "Para continuar, escolha uma das opções.");
      return waitFor(waiting);
    }

    await registerCampaignEntry({
      organizationId,
      campaignId: campaign.id,
      rulesVersion: campaign.rulesVersion,
      leadId: ref.leadId,
      customerName: waiting.customerName || member.name,
    });
    await trackLeadEvent({
      leadId: ref.leadId,
      kind: "consent_accepted",
      metadata: { ...consentMetadata, termsText: campaign.rulesSummary, policyUrl: campaign.rulesUrl },
    });
    return finishWith(PROMO_ENROLL_OUTPUTS.enrolled);
  } catch (error) {
    return failed(error);
  }
};

// ─── Registrar cupom ─────────────────────────────────────────

const RECEIPT_EXIT: Record<StoredReceiptResult["outcome"] | "daily_limit" | "file_missing" | "try_later", string> = {
  accepted: PROMO_RECEIPT_OUTPUTS.accepted,
  duplicate: PROMO_RECEIPT_OUTPUTS.duplicate,
  rejected: PROMO_RECEIPT_OUTPUTS.notValid,
  pending_review: PROMO_RECEIPT_OUTPUTS.inReview,
  daily_limit: PROMO_RECEIPT_OUTPUTS.dailyLimit,
  file_missing: PROMO_RECEIPT_OUTPUTS.unreadable,
  try_later: PROMO_RECEIPT_OUTPUTS.tryLater,
};

function exitOfReceipt(result: Exclude<RegisterReceiptResult, { outcome: "already_processed" }>): string {
  if (result.outcome === "rejected" && result.reason === "unreadable") return PROMO_RECEIPT_OUTPUTS.unreadable;
  return RECEIPT_EXIT[result.outcome];
}

/** A foto da variável e as outras que o cliente mandou junto, desde a última mensagem enviada (RF-4). */
async function receiptMessagesOf(conversationId: string, photoMessageId: string) {
  const lastOutbound = await prisma.message.findFirst({
    where: { conversationId, fromMe: true },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const sentTogether = await prisma.message.findMany({
    where: { conversationId, fromMe: false, mediaUrl: { not: null }, ...(lastOutbound ? { createdAt: { gt: lastOutbound.createdAt } } : {}) },
    orderBy: { createdAt: "asc" },
    take: MAX_RECEIPTS_PER_STEP,
    select: { id: true, messageId: true, mediaUrl: true, mimetype: true },
  });
  const photos = sentTogether.filter((message) => isPhotoOrPdf(message.mimetype));
  if (!photoMessageId || photos.some((message) => message.messageId === photoMessageId)) return photos;
  // A foto da Pergunta veio antes da última mensagem enviada: entra primeiro, se for desta conversa.
  const chosen = await prisma.message.findFirst({
    where: { messageId: photoMessageId, conversationId, fromMe: false, mediaUrl: { not: null } },
    select: { id: true, messageId: true, mediaUrl: true, mimetype: true },
  });
  return chosen && isPhotoOrPdf(chosen.mimetype) ? [chosen, ...photos].slice(0, MAX_RECEIPTS_PER_STEP) : photos;
}

export const promoReceiptExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  const config = parsePromoReceipt(data);
  if (dryRun) return finishWith(PROMO_RECEIPT_OUTPUTS.accepted, { dryRun: true });
  const ref = leadRefOf(context);
  if (!ref) return MISSING_LEAD;

  try {
    const { organizationId, campaign } = await campaignOfLead(ref);
    if (!campaign || campaignAvailabilityAt(campaign, new Date()) !== "open") return finishWith(PROMO_RECEIPT_OUTPUTS.closed);
    const { member, entry } = await findCampaignEntryForLead({ organizationId, campaignId: campaign.id, leadId: ref.leadId });
    if (!member || !entry) return finishWith(PROMO_RECEIPT_OUTPUTS.notEnrolled);

    const conversation = await prisma.conversation.findFirst({ where: { leadId: ref.leadId, trackingId: ref.trackingId }, select: { id: true } });
    const messages = conversation ? await receiptMessagesOf(conversation.id, flowVariable(context, config.photoVariable)) : [];
    if (messages.length === 0) return finishWith(PROMO_RECEIPT_OUTPUTS.unreadable, { reason: "no_photo" });

    const results: Exclude<RegisterReceiptResult, { outcome: "already_processed" }>[] = [];
    for (const message of messages) {
      const result = await registerReceipt({
        organizationId,
        campaign,
        memberId: member.id,
        memberName: member.name,
        leadId: ref.leadId,
        trackingId: ref.trackingId,
        message: { id: message.id, fileKey: message.mediaUrl, mimetype: message.mimetype },
      });
      // Cupom que já passou por aqui (repetição do passo) entra no resultado, mas não recebe resposta de novo.
      if (result.outcome === "already_processed") {
        results.push(result.stored);
        continue;
      }
      results.push(result);
      if (config.sendDefaultReply) await sendText(ref, context, nodeId, receiptReplyOf(result, campaign));
    }

    const accepted = results.filter((result): result is Extract<StoredReceiptResult, { outcome: "accepted" }> => result.outcome === "accepted");
    const codes = accepted.flatMap((result) => result.codes);
    const lastAccepted = accepted.at(-1);
    const lastResult = results[results.length - 1];
    return {
      chosenOutput: exitOfReceipt(lastResult),
      output: {
        isWaitingReply: false,
        finishedBy: exitOfReceipt(lastResult),
        receipts: results.length,
        vars: {
          numeros_da_sorte: codes.join(", "),
          qtd_numeros: String(codes.length),
          valor_cupom: lastAccepted ? formatCents(lastAccepted.totalCents) : "",
          saldo_proximo_numero: lastAccepted ? formatCents(lastAccepted.carryOverCents) : "",
        },
      },
    } satisfies NodeExecutionResult;
  } catch (error) {
    return failed(error);
  }
};

// ─── Consultar promoção ──────────────────────────────────────

async function lookupResult(organizationId: string, campaign: ActiveCampaign, memberId: string): Promise<NodeExecutionResult> {
  const [summary, codes, program] = await Promise.all([
    getMemberCampaignSummary({ campaignId: campaign.id, memberId }),
    listMemberLuckyCodes({ campaignId: campaign.id, memberId }),
    getActiveProgram(organizationId),
  ]);
  return finishWith(PROMO_LOOKUP_OUTPUTS.done, {
    vars: {
      qtd_cupons: String(summary.acceptedReceipts),
      total_compras: formatCents(summary.totalSpentCents),
      qtd_numeros: String(summary.validNumbers),
      saldo_proximo_numero: formatCents(summary.carryOverCents),
      numeros_da_sorte: codes.join(", "),
      stars: program ? String(summary.starsBalance) : "",
    },
  });
}

export const promoLookupExecutor: NodeExecutor = async ({ nodeId, data, context, dryRun }) => {
  const config = parsePromoLookup(data);
  if (dryRun) return finishWith(PROMO_LOOKUP_OUTPUTS.done, { dryRun: true });
  const ref = leadRefOf(context);
  if (!ref) return MISSING_LEAD;

  try {
    const { organizationId, campaign } = await campaignOfLead(ref);
    if (!campaign) return finishWith(PROMO_LOOKUP_OUTPUTS.notEnrolled, { reason: "no_campaign" });
    const { member, entry } = await findCampaignEntryForLead({ organizationId, campaignId: campaign.id, leadId: ref.leadId });
    if (!member || !entry) return finishWith(PROMO_LOOKUP_OUTPUTS.notEnrolled);
    if (!config.askPhone) return lookupResult(organizationId, campaign, member.id);

    const lead = await prisma.lead.findUnique({ where: { id: ref.leadId }, select: { phone: true } });
    if (!lead?.phone) return finishWith(PROMO_LOOKUP_OUTPUTS.phoneMismatch, { reason: "lead_without_phone" });

    const waiting = waitingStateOf<Record<string, never>>(nodeId, context);
    if (!waiting) {
      await sendText(ref, context, nodeId, "Para sua segurança, digite o *número de celular* cadastrado na promoção, com DDD.");
      await markAwaitingReply({ ...ref, nodeId, timeoutMinutes: config.replyDeadline.timeoutMinutes });
      return waitForReply({}, config.replyDeadline.timeoutMinutes);
    }
    const reply = readClientReply(context);
    if (reply.hasTimedOut) return config.replyDeadline.hasDeadline ? finishWith(PROMO_LOOKUP_OUTPUTS.noReply) : EXPIRED_RESULT;
    if (reply.clickedId || interruptOf(reply.text) !== null) return finishWith(PROMO_LOOKUP_OUTPUTS.other);
    if (!isSamePhone(reply.text, lead.phone)) return finishWith(PROMO_LOOKUP_OUTPUTS.phoneMismatch);
    return lookupResult(organizationId, campaign, member.id);
  } catch (error) {
    return failed(error);
  }
};

export const PROMO_EXECUTORS: [string, NodeExecutor][] = [
  ["PROMO_ENROLL", promoEnrollExecutor],
  ["PROMO_RECEIPT", promoReceiptExecutor],
  ["PROMO_LOOKUP", promoLookupExecutor],
];
