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
import { formatCents, isSamePhone } from "@/features/star-friends/utils/campaign";
import { sendCodedReply, type CodedReplyOption } from "./coded-reply";
import type { AgentContext } from "./context";
import { CAMPAIGN_OPTION, CAMPAIGN_OPTION_PREFIX } from "./coded-menu-options";
import { clientMenuId } from "./guided-menu/menu-ids";

// Campanha de sorteio do STAR FRIENDS pela conversa (spec 0102). Tudo aqui é regra fixa: nenhuma
// chamada de modelo decide o que responder. O cliente é sempre o do número que escreveu (D-2):
// o telefone que ele digita só é comparado, nunca usado para buscar dados.

const AWAITING_KEY = "campaignAwaiting";
const AWAITING_TIMEOUT_MINUTES = 30;
const ASKS_FOR_CAMPAIGN = /\b(promocao|promo|sorteio|numeros? da sorte|participar|15 anos|aniversario|cadastrar (meu |o )?cupom)\b/;
const WRONG_DEVICE_MESSAGE = "Você não está acessando pelo dispositivo que se cadastrou na promoção.";
const SAYS_YES = /^(sim|aceito|aceitar|concordo|ok|pode|1)[\s!.]*$/;
const SAYS_NO = /^(nao|nao aceito|recuso|2)[\s!.]*$/;
const VALID_NAME = /^[\p{L}][\p{L}\s.'-]{1,59}$/u;
const MAX_CODES_IN_MESSAGE = 60;
const MAX_RECEIPTS_PER_REPLY = 10;

type AwaitingStep = "name" | "consent" | "receipt" | "phone_points" | "phone_codes";
type CampaignAwaiting = { step: AwaitingStep; campaignId: string; expiresAt: string; customerName?: string };

const MEMBER_OPTIONS: CodedReplyOption[] = [
  { id: CAMPAIGN_OPTION.newReceipt, title: "Cadastrar novo cupom" },
  { id: CAMPAIGN_OPTION.points, title: "Ver meus pontos" },
  { id: CAMPAIGN_OPTION.codes, title: "Ver meus códigos" },
];
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

function receiptReplyOf(result: RegisterReceiptResult, campaign: ActiveCampaign): string {
  const perNumber = formatCents(campaign.amountPerNumberCents);
  switch (result.outcome) {
    case "accepted": {
      const carryLine = `Saldo acumulado para o próximo número: ${formatCents(result.carryOverCents)} de ${perNumber}.`;
      if (result.codes.length === 0) {
        return `Cupom de ${formatCents(result.totalCents)} cadastrado. ✅\n\nEle ainda não completou ${perNumber}, então o valor ficou guardado.\n${carryLine}`;
      }
      const codesLabel = result.codes.length === 1 ? "Seu número da sorte" : `Seus ${result.codes.length} números da sorte`;
      // A Meta corta em 1024 caracteres a mensagem que leva botões.
      const shownCodes = result.codes.slice(0, MAX_CODES_IN_MESSAGE);
      const hiddenLine = result.codes.length > shownCodes.length ? `\n… e mais ${result.codes.length - shownCodes.length}, em "Ver meus códigos".` : "";
      return `Cupom de ${formatCents(result.totalCents)} cadastrado. ✅\n\n${codesLabel}:\n${shownCodes.map((code) => `🎟️ ${code}`).join("\n")}${hiddenLine}\n\n${carryLine}\n\nOs cupons passam por uma conferência antes do sorteio. Boa sorte!`;
    }
    case "duplicate":
      return "Este cupom já foi cadastrado na promoção. Cada cupom vale uma vez só.";
    case "rejected":
      if (result.reason === "wrong_issuer") return "Este cupom não é de uma compra feita na nossa loja, então não vale para a promoção.";
      if (result.reason === "out_of_period") return "A data desta compra está fora do período da promoção.";
      if (result.reason === "not_a_receipt") return "Essa imagem não parece ser um cupom de compra. Envie a foto do cupom inteiro, com o valor total e a data.";
      return "Não consegui ler o valor do cupom nesta foto. Tire outra foto com o cupom inteiro, bem iluminado e sem dobras, e envie de novo.";
    case "pending_review":
      return "Recebemos o seu cupom. 📋\n\nNão deu para ler todos os dados pela foto, então ele vai passar por uma conferência da nossa equipe. Assim que for conferido, os números da sorte aparecem em \"Ver meus códigos\".";
    case "daily_limit":
      return "Você atingiu o limite de cupons de hoje. Amanhã você pode cadastrar mais.";
    case "file_missing":
      return "Não consegui abrir o arquivo. Envie a foto do cupom de novo, por favor.";
    case "try_later":
      return "Não consegui conferir o cupom agora. Tente de novo em alguns minutos.";
    case "already_processed":
      return receiptReplyOf(result.stored, campaign);
  }
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
  const asksForCampaignInText = !clickedId && !awaiting && ASKS_FOR_CAMPAIGN.test(normalizeAnswer(inbound.body ?? ""));
  const campaignClick = clickedCampaignOption ?? (asksForCampaignInText ? CAMPAIGN_OPTION.start : null);
  // Quem já está cadastrado manda a foto direto, sem passar pelo botão "Cadastrar novo cupom".
  const isUnpromptedPhoto = !campaignClick && !awaiting && !isOtherClick && isReceiptFile(inbound);
  if (!campaignClick && !awaiting && !isUnpromptedPhoto) return { handled: false };

  const text = (inbound.body ?? "").trim();
  const hasMedia = Boolean(inbound.mediaUrl || inbound.mediaType || inbound.mimetype);
  // "menu", "cancelar" e "falar com atendente" devolvem a conversa ao atendimento de sempre.
  if (!campaignClick && !hasMedia && interruptOf(text) !== null) return { handled: false };

  const campaign = await findActiveCampaign(ctx.organizationId, ctx.trackingId);
  const availability = campaign ? campaignAvailabilityAt(campaign, new Date()) : "ended";
  if (!campaign || (awaiting && awaiting.campaignId !== campaign.id)) {
    if (!campaignClick) return { handled: false };
    await sendCodedReply(ctx, { body: "A promoção não está ativa no momento.", options: [BACK_TO_MENU] });
    return { handled: true };
  }

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
      await sendCodedReply(ctx, { body: `*${campaign.name}*\n\nOlá, ${member.name}! O que você quer fazer?`, options: MEMBER_OPTIONS });
      return { handled: true };
    }
    if (availability !== "open") {
      await sendCodedReply(ctx, { body: availability === "not_started" ? "A promoção ainda não começou." : "A promoção já foi encerrada.", options: [BACK_TO_MENU] });
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
      body: `Obrigado, ${text}!\n\n${campaign.rulesSummary.trim()}${rulesLink}\n\nVocê aceita as regras da promoção?`,
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
    await sendCodedReply(ctx, { body: "Você ainda não está cadastrado na promoção.", options: [{ id: CAMPAIGN_OPTION.start, title: "Quero participar" }] });
    return { handled: true };
  }

  if (campaignClick === CAMPAIGN_OPTION.newReceipt) {
    if (availability !== "open") {
      await sendCodedReply(ctx, { body: "A promoção não está recebendo cupons no momento.", options: MEMBER_OPTIONS });
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
    for (const [resultIndex, result] of results.entries()) {
      const isLastReply = resultIndex === results.length - 1;
      await sendCodedReply(ctx, {
        body: receiptReplyOf(result, campaign),
        options: isLastReply && !shouldAskAgain ? MEMBER_OPTIONS : undefined,
        metadata: isLastReply && shouldAskAgain ? awaitingMetadata("receipt", campaign) : undefined,
      });
    }
    return { handled: true };
  }

  if (campaignClick === CAMPAIGN_OPTION.points || campaignClick === CAMPAIGN_OPTION.codes) {
    await sendCodedReply(ctx, {
      body: "Para sua segurança, digite o *número de celular* cadastrado na promoção, com DDD.",
      metadata: awaitingMetadata(campaignClick === CAMPAIGN_OPTION.points ? "phone_points" : "phone_codes", campaign),
    });
    return { handled: true };
  }

  if ((awaiting?.step === "phone_points" || awaiting?.step === "phone_codes") && !campaignClick) {
    if (hasMedia || !isSamePhone(text, ctx.lead.phone)) {
      await sendCodedReply(ctx, { body: WRONG_DEVICE_MESSAGE, options: [BACK_TO_MENU] });
      return { handled: true };
    }
    if (awaiting.step === "phone_points") {
      const summary = await getMemberCampaignSummary({ campaignId: campaign.id, memberId: member.id });
      await sendCodedReply(ctx, {
        body: [
          `*Seus pontos — ${campaign.name}*`,
          "",
          `Compras cadastradas: ${formatCents(summary.totalSpentCents)} em ${summary.acceptedReceipts} cupom(ns)`,
          `Números da sorte: ${summary.validNumbers}`,
          `Saldo para o próximo número: ${formatCents(summary.carryOverCents)} de ${formatCents(campaign.amountPerNumberCents)}`,
          ...(ctx.starFriendsProgramName ? [`Stars no ${ctx.starFriendsProgramName}: ${summary.starsBalance} ⭐`] : []),
        ].join("\n"),
        options: MEMBER_OPTIONS,
      });
      return { handled: true };
    }
    const codes = await listMemberLuckyCodes({ campaignId: campaign.id, memberId: member.id });
    const shownCodes = codes.slice(0, MAX_CODES_IN_MESSAGE);
    const hiddenLine = codes.length > shownCodes.length ? `\n\n… e mais ${codes.length - shownCodes.length}. Peça a lista completa a um atendente.` : "";
    await sendCodedReply(ctx, {
      body: codes.length === 0 ? "Você ainda não tem números da sorte. Cadastre um cupom para ganhar." : `*Seus números da sorte (${codes.length})*\n\n${shownCodes.join(" · ")}${hiddenLine}`,
      options: MEMBER_OPTIONS,
    });
    return { handled: true };
  }

  return { handled: false };
}
