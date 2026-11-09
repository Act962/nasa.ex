import "server-only";
import prisma from "@/lib/prisma";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { interruptOf, normalizeAnswer } from "@/features/workflows/lib/conversation-steps";
import {
  campaignAvailabilityAt,
  findActiveCampaign,
  findCampaignEntryForLead,
  getMemberCampaignSummary,
  listMemberLuckyCodes,
  registerCampaignEntry,
  type ActiveCampaign,
} from "@/features/star-friends/lib/campaign/campaign";
import { registerReceipt, type RegisterReceiptResult } from "@/features/star-friends/lib/campaign/register-receipt";
import { findMemberForLead } from "@/features/star-friends/lib/members";
import { isSamePhone } from "@/features/star-friends/utils/campaign";
import { asksForProgramByName, campaignNoun, pointsSummaryMessage, rewardsMessage } from "@/features/star-friends/utils/campaign-messages";
import { sendCodedReply, type CodedReplyOption } from "./coded-reply";
import type { AgentContext } from "./context";
import { CAMPAIGN_OPTION, CAMPAIGN_OPTION_PREFIX } from "./coded-menu-options";
import { clientMenuId } from "./guided-menu/menu-ids";
import { memberOptionsFor, receiptReplyOf, tierLabelOf, wrongDeviceMessage } from "./campaign-replies";

// Campanha por cupom do STAR FRIENDS pela conversa: sorteio (spec 0102) ou pontos (spec 0135). Tudo aqui é regra fixa: nenhuma
// chamada de modelo decide o que responder. O cliente é sempre o do número que escreveu (D-2):
// o telefone que ele digita só é comparado, nunca usado para buscar dados.

const AWAITING_KEY = "campaignAwaiting";
const AWAITING_TIMEOUT_MINUTES = 30;
const ASKS_FOR_CAMPAIGN = /\b(promocao|promo|sorteio|numeros? da sorte|participar|15 anos|aniversario|cadastrar (meu |o )?cupom)\b/;
// RF-11: só abre a campanha quando ela é de pontos (conferido depois de carregar a campanha).
const ASKS_FOR_POINTS = /\b(pontos|fidelidade|estrelas)\b/;
const SAYS_YES = /^(sim|aceito|aceitar|concordo|ok|pode|1)[\s!.]*$/;
const SAYS_NO = /^(nao|nao aceito|recuso|2)[\s!.]*$/;
const VALID_NAME = /^[\p{L}][\p{L}\s.'-]{1,59}$/u;
const MAX_CODES_IN_MESSAGE = 60;
const MAX_RECEIPTS_PER_REPLY = 10;
const MAX_REWARDS_IN_MESSAGE = 20;

type AwaitingStep = "name" | "consent" | "receipt" | "phone_points" | "phone_codes";
type CampaignAwaiting = { step: AwaitingStep; campaignId: string; expiresAt: string; customerName?: string };

const BACK_TO_MENU: CodedReplyOption = { id: clientMenuId({ step: "menu" }), title: "Voltar ao menu" };

function readAwaiting(metadata: unknown, now: Date): CampaignAwaiting | null {
  const stored = (metadata as Record<string, unknown> | null)?.[AWAITING_KEY] as Partial<CampaignAwaiting> | undefined;
  if (!stored || typeof stored.step !== "string" || typeof stored.campaignId !== "string" || typeof stored.expiresAt !== "string") return null;
  if (new Date(stored.expiresAt).getTime() <= now.getTime()) return null;
  return stored as CampaignAwaiting;
}

function awaitingMetadata(step: AwaitingStep, campaign: ActiveCampaign, customerName?: string) {
  const expiresAt = new Date(Date.now() + AWAITING_TIMEOUT_MINUTES * 60_000).toISOString();
  return { [AWAITING_KEY]: { step, campaignId: campaign.id, expiresAt, ...(customerName ? { customerName } : {}) } };
}

/** Foto ou PDF que pode ser um cupom. Figurinha (webp) fica de fora. */
function isReceiptFile(message: { mediaUrl: string | null; mimetype: string | null }): boolean {
  const mimetype = message.mimetype ?? "";
  if (!message.mediaUrl || mimetype.includes("webp")) return false;
  return mimetype.startsWith("image/") || mimetype.includes("pdf");
}

async function isRegisteredInCampaign(organizationId: string, campaignId: string, leadId: string): Promise<boolean> {
  const member = await findMemberForLead(organizationId, leadId);
  if (!member) return false;
  const entry = await prisma.loyaltyCampaignEntry.findUnique({
    where: { campaignId_memberId: { campaignId, memberId: member.id } },
    select: { id: true },
  });
  return Boolean(entry);
}

function isNotAReceipt(result: RegisterReceiptResult): boolean {
  return result.outcome === "rejected" && result.reason === "not_a_receipt";
}

function needsNewPhoto(result: RegisterReceiptResult): boolean {
  return result.outcome === "file_missing" || isNotAReceipt(result) || (result.outcome === "rejected" && result.reason === "unreadable");
}

async function askForReceipt(ctx: AgentContext, campaign: ActiveCampaign, intro: string): Promise<void> {
  await sendCodedReply(ctx, {
    body: `${intro}Envie agora a *foto do cupom* da sua compra. Mostre o cupom inteiro, com o valor total e a data.`,
    metadata: awaitingMetadata("receipt", campaign),
  });
}

export async function handleCampaign(ctx: AgentContext, inboundMessageId: string): Promise<{ handled: boolean }> {
  if (ctx.catalogOrder || !ctx.lead.phone || !ctx.instance) return { handled: false };
  const inbound = await prisma.message.findFirst({
    where: { id: inboundMessageId, conversationId: ctx.conversation.id, fromMe: false },
    select: { id: true, body: true, mediaUrl: true, mimetype: true, mediaType: true, metadata: true, createdAt: true },
  });
  if (!inbound) return { handled: false };

  const clickedId = (inbound.metadata as { interactiveReplyId?: unknown } | null)?.interactiveReplyId;
  const clickedCampaignOption = typeof clickedId === "string" && clickedId.startsWith(CAMPAIGN_OPTION_PREFIX) ? clickedId : null;
  // Clique em opção de outro menu tira o cliente da campanha.
  const isOtherClick = typeof clickedId === "string" && !clickedCampaignOption;
  const previousOutbound = await prisma.message.findFirst({
    where: { conversationId: ctx.conversation.id, fromMe: true, createdAt: { lt: inbound.createdAt } },
    orderBy: { createdAt: "desc" },
    select: { metadata: true, createdAt: true },
  });
  const awaiting = isOtherClick ? null : readAwaiting(previousOutbound?.metadata, inbound.createdAt);
  // CB-19: o link da bio chega com "Quero participar da promoção" escrito. Sem isso a frase ia para a
  // assistente, que inventou um cadastro no teste real. Pedido escrito vale como o clique em "Promoção".
  const normalizedBody = normalizeAnswer(inbound.body ?? "");
  const asksForRaffleInText = ASKS_FOR_CAMPAIGN.test(normalizedBody);
  const asksForPointsInText = ASKS_FOR_POINTS.test(normalizedBody) || asksForProgramByName(normalizedBody, ctx.starFriendsProgramName);
  const asksForCampaignInText = !clickedId && !awaiting && (asksForRaffleInText || asksForPointsInText);
  const campaignClick = clickedCampaignOption ?? (asksForCampaignInText ? CAMPAIGN_OPTION.start : null);
  // Quem já está cadastrado manda a foto direto, sem passar pelo botão "Cadastrar novo cupom".
  const isUnpromptedPhoto = !campaignClick && !awaiting && !isOtherClick && isReceiptFile(inbound);
  if (!campaignClick && !awaiting && !isUnpromptedPhoto) return { handled: false };

  const text = (inbound.body ?? "").trim();
  const hasMedia = Boolean(inbound.mediaUrl || inbound.mediaType || inbound.mimetype);
  // "menu", "cancelar" e "falar com atendente" devolvem a conversa ao atendimento de sempre.
  if (!campaignClick && !hasMedia && interruptOf(text) !== null) return { handled: false };

  const campaign = await findActiveCampaign(ctx.organizationId, ctx.trackingId);
  // "pontos"/"fidelidade" escrito só abre campanha de pontos; numa de sorteio, segue o atendimento de sempre.
  if (asksForCampaignInText && !asksForRaffleInText && campaign?.mode !== "POINTS") return { handled: false };
  const availability = campaign ? campaignAvailabilityAt(campaign, new Date()) : "ended";
  if (!campaign || (awaiting && awaiting.campaignId !== campaign.id)) {
    if (!campaignClick) return { handled: false };
    await sendCodedReply(ctx, { body: "A promoção não está ativa no momento.", options: [BACK_TO_MENU] });
    return { handled: true };
  }
  const noun = campaignNoun(campaign.mode);
  const memberOptions = memberOptionsFor(campaign.mode);

  if (isUnpromptedPhoto) {
    const canReceiveReceipt = availability === "open" && (await isRegisteredInCampaign(ctx.organizationId, campaign.id, ctx.lead.id));
    if (!canReceiveReceipt) return { handled: false };
  }

  const { member, entry } = await findCampaignEntryForLead({ organizationId: ctx.organizationId, campaignId: campaign.id, leadId: ctx.lead.id });
  if (!member) return { handled: false };
  const normalizedText = normalizeAnswer(text);
  const wantsToAccept = campaignClick === CAMPAIGN_OPTION.accept || (awaiting?.step === "consent" && !campaignClick && SAYS_YES.test(normalizedText));
  const wantsToRefuse = campaignClick === CAMPAIGN_OPTION.refuse || (awaiting?.step === "consent" && !campaignClick && SAYS_NO.test(normalizedText));

  if (campaignClick === CAMPAIGN_OPTION.start) {
    if (entry) {
      await sendCodedReply(ctx, { body: `*${campaign.name}*\n\nOlá, ${member.name}! O que você quer fazer?`, options: memberOptions });
      return { handled: true };
    }
    if (availability !== "open") {
      await sendCodedReply(ctx, { body: availability === "not_started" ? `${noun.The} ainda não começou.` : `${noun.The} já foi encerrad${campaign.mode === "POINTS" ? "o" : "a"}.`, options: [BACK_TO_MENU] });
      return { handled: true };
    }
    await sendCodedReply(ctx, { body: `*${campaign.name}* 🎉\n\nPara participar, me diga o seu *nome completo*.`, metadata: awaitingMetadata("name", campaign) });
    return { handled: true };
  }

  if (awaiting?.step === "name" && !campaignClick) {
    if (hasMedia || !VALID_NAME.test(text)) {
      await sendCodedReply(ctx, { body: "Escreva só o seu nome completo, por favor.", metadata: awaitingMetadata("name", campaign) });
      return { handled: true };
    }
    const rulesLink = campaign.rulesUrl ? `\n\nRegulamento completo: ${campaign.rulesUrl}` : "";
    await sendCodedReply(ctx, {
      body: `Obrigado, ${text}!\n\n${campaign.rulesSummary.trim()}${rulesLink}\n\nVocê aceita as regras ${noun.of}?`,
      options: [
        { id: CAMPAIGN_OPTION.accept, title: "Aceito" },
        { id: CAMPAIGN_OPTION.refuse, title: "Não aceito" },
      ],
      metadata: awaitingMetadata("consent", campaign, text),
    });
    return { handled: true };
  }

  if (wantsToRefuse) {
    await trackLeadEvent({ leadId: ctx.lead.id, kind: "consent_refused", metadata: { termsVersion: campaign.rulesVersion, source: "star-friends-campaign", campaignId: campaign.id } });
    await sendCodedReply(ctx, { body: "Tudo bem. Sem o aceite das regras não é possível participar. Se mudar de ideia, é só voltar aqui.", options: [BACK_TO_MENU] });
    return { handled: true };
  }

  if (wantsToAccept) {
    if (entry) {
      await askForReceipt(ctx, campaign, "");
      return { handled: true };
    }
    // Sem o nome guardado (espera vencida), o cadastro recomeça: o aceite não vale sem identificação.
    if (awaiting?.step !== "consent" || !awaiting.customerName || availability !== "open") {
      await sendCodedReply(ctx, { body: "Vamos recomeçar o cadastro. Me diga o seu *nome completo*.", metadata: awaitingMetadata("name", campaign) });
      return { handled: true };
    }
    await registerCampaignEntry({
      organizationId: ctx.organizationId,
      campaignId: campaign.id,
      rulesVersion: campaign.rulesVersion,
      leadId: ctx.lead.id,
      customerName: awaiting.customerName,
    });
    await trackLeadEvent({
      leadId: ctx.lead.id,
      kind: "consent_accepted",
      metadata: { termsVersion: campaign.rulesVersion, termsText: campaign.rulesSummary, policyUrl: campaign.rulesUrl, source: "star-friends-campaign", campaignId: campaign.id },
    });
    await askForReceipt(ctx, campaign, "Cadastro feito! ✅\n\n");
    return { handled: true };
  }

  if (awaiting?.step === "consent" && !campaignClick) {
    await sendCodedReply(ctx, {
      body: "Para continuar, escolha uma das opções.",
      options: [
        { id: CAMPAIGN_OPTION.accept, title: "Aceito" },
        { id: CAMPAIGN_OPTION.refuse, title: "Não aceito" },
      ],
      metadata: awaitingMetadata("consent", campaign, awaiting.customerName),
    });
    return { handled: true };
  }

  // Daqui para baixo, só quem já se cadastrou.
  if (!entry) {
    await sendCodedReply(ctx, { body: `Você ainda não está cadastrado ${noun.in}.`, options: [{ id: CAMPAIGN_OPTION.start, title: "Quero participar" }] });
    return { handled: true };
  }

  if (campaignClick === CAMPAIGN_OPTION.newReceipt) {
    if (availability !== "open") {
      await sendCodedReply(ctx, { body: `${noun.The} não está recebendo cupons no momento.`, options: memberOptions });
      return { handled: true };
    }
    await askForReceipt(ctx, campaign, "");
    return { handled: true };
  }

  if ((awaiting?.step === "receipt" || isUnpromptedPhoto) && !campaignClick) {
    if (!hasMedia) {
      await sendCodedReply(ctx, { body: "Preciso da *foto do cupom*. Toque no clipe 📎 e envie a imagem.", metadata: awaitingMetadata("receipt", campaign) });
      return { handled: true };
    }
    // O atendimento espera 3 s e só roda para a última mensagem: as fotos enviadas logo antes dela
    // não disparam nada sozinhas, então são cadastradas aqui, na ordem em que chegaram.
    const earlierPhotos = previousOutbound
      ? await prisma.message.findMany({
          where: {
            conversationId: ctx.conversation.id,
            fromMe: false,
            id: { not: inbound.id },
            mediaUrl: { not: null },
            createdAt: { gt: previousOutbound.createdAt },
            OR: [{ mimetype: { startsWith: "image/" } }, { mimetype: { contains: "pdf" } }],
            NOT: { mimetype: { contains: "webp" } },
          },
          orderBy: { createdAt: "asc" },
          take: MAX_RECEIPTS_PER_REPLY - 1,
          select: { id: true, mediaUrl: true, mimetype: true },
        })
      : [];
    // Nova tentativa depois de uma falha no envio: o cupom já foi gravado, mas o cliente ficou sem
    // resposta. Se algo já saiu depois da mensagem dele, é reentrega e ninguém responde de novo.
    const replyAlreadySent = await prisma.message.findFirst({
      where: { conversationId: ctx.conversation.id, fromMe: true, createdAt: { gt: inbound.createdAt } },
      select: { id: true },
    });
    const results: RegisterReceiptResult[] = [];
    for (const receiptMessage of [...earlierPhotos, inbound]) {
      const result = await registerReceipt({
        organizationId: ctx.organizationId,
        campaign,
        memberId: member.id,
        memberName: member.name,
        leadId: ctx.lead.id,
        trackingId: ctx.trackingId,
        message: { id: receiptMessage.id, fileKey: receiptMessage.mediaUrl, mimetype: receiptMessage.mimetype },
      });
      if (result.outcome !== "already_processed") results.push(result);
      else if (!replyAlreadySent) results.push(result.stored);
    }
    if (results.length === 0) return { handled: true };
    // Foto mandada sem ninguém ter pedido e que não é cupom: a conversa segue com o atendimento de sempre.
    if (isUnpromptedPhoto && results.every(isNotAReceipt)) return { handled: false };
    const shouldAskAgain = results.some(needsNewPhoto);
    // RF-3: no modo pontos a resposta mostra o saldo de ⭐ depois do cupom.
    const starsBalance = campaign.mode === "POINTS" ? (await getMemberCampaignSummary({ campaignId: campaign.id, memberId: member.id })).starsBalance : null;
    for (const [resultIndex, result] of results.entries()) {
      const isLastReply = resultIndex === results.length - 1;
      await sendCodedReply(ctx, {
        body: receiptReplyOf(result, campaign, starsBalance),
        options: isLastReply && !shouldAskAgain ? memberOptions : undefined,
        metadata: isLastReply && shouldAskAgain ? awaitingMetadata("receipt", campaign) : undefined,
      });
    }
    return { handled: true };
  }

  if (campaignClick === CAMPAIGN_OPTION.rewards) {
    const rewards = await prisma.loyaltyReward.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      orderBy: { costStars: "asc" },
      take: MAX_REWARDS_IN_MESSAGE,
      select: { name: true, costStars: true },
    });
    await sendCodedReply(ctx, { body: rewardsMessage(rewards), options: memberOptions });
    return { handled: true };
  }

  if (campaignClick === CAMPAIGN_OPTION.points || campaignClick === CAMPAIGN_OPTION.codes) {
    // CB-7: clique antigo em "Ver meus códigos" numa campanha de pontos vale como "Ver meus pontos".
    const wantsCodes = campaignClick === CAMPAIGN_OPTION.codes && campaign.mode !== "POINTS";
    await sendCodedReply(ctx, {
      body: `Para sua segurança, digite o *número de celular* cadastrado ${noun.in}, com DDD.`,
      metadata: awaitingMetadata(wantsCodes ? "phone_codes" : "phone_points", campaign),
    });
    return { handled: true };
  }

  if ((awaiting?.step === "phone_points" || awaiting?.step === "phone_codes") && !campaignClick) {
    if (hasMedia || !isSamePhone(text, ctx.lead.phone)) {
      await sendCodedReply(ctx, { body: wrongDeviceMessage(campaign.mode), options: [BACK_TO_MENU] });
      return { handled: true };
    }
    if (awaiting.step === "phone_points" || campaign.mode === "POINTS") {
      const summary = await getMemberCampaignSummary({ campaignId: campaign.id, memberId: member.id });
      const tierLabel = campaign.mode === "POINTS" ? await tierLabelOf(ctx.organizationId, member.id) : null;
      await sendCodedReply(ctx, {
        body: pointsSummaryMessage({
          mode: campaign.mode,
          campaignName: campaign.name,
          programName: ctx.starFriendsProgramName,
          totalSpentCents: summary.totalSpentCents,
          acceptedReceipts: summary.acceptedReceipts,
          validNumbers: summary.validNumbers,
          carryOverCents: summary.carryOverCents,
          amountPerNumberCents: campaign.amountPerNumberCents,
          starsBalance: summary.starsBalance,
          tierLabel,
        }),
        options: memberOptions,
      });
      return { handled: true };
    }
    const codes = await listMemberLuckyCodes({ campaignId: campaign.id, memberId: member.id });
    const shownCodes = codes.slice(0, MAX_CODES_IN_MESSAGE);
    const hiddenLine = codes.length > shownCodes.length ? `\n\n… e mais ${codes.length - shownCodes.length}. Peça a lista completa a um atendente.` : "";
    await sendCodedReply(ctx, {
      body: codes.length === 0 ? "Você ainda não tem números da sorte. Cadastre um cupom para ganhar." : `*Seus números da sorte (${codes.length})*\n\n${shownCodes.join(" · ")}${hiddenLine}`,
      options: memberOptions,
    });
    return { handled: true };
  }

  return { handled: false };
}
