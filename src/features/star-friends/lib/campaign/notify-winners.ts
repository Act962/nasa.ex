import "server-only";
import prisma from "@/lib/prisma";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import { normalizePhoneToMetaE164 } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import { persistOutboundMessage } from "@/features/tracking-chat-ai/lib/persist";
import { chargeMessageOutbound } from "@/features/stars/lib/charge-message-outbound";
import { decryptStoredMetaCredentialsPartial } from "@/features/tracking-chat/lib/providers/meta-credentials";
import { getMessageTemplates } from "@/http/whats-oficial";
import { summarizeTemplate } from "@/app/router/integrations/list-whatsapp-templates";
import type { LoyaltyActor } from "../actor";
import { auditLoyaltyAction } from "../audit";
import {
  hasEmptyFixedText,
  positionsMissingPrize,
  renderTemplateBody,
  winnerVariableValues,
  type WinnerVariable,
} from "../../utils/winner-notice";

// Aviso dos ganhadores pelo modelo aprovado da Meta (spec 0148). Cada ganhador é reservado antes
// do envio (`notifiedAt`), então dois cliques não mandam duas mensagens; se a Meta recusa, a reserva
// volta e o motivo fica gravado para tentar de novo.

const SEND_BATCH_SIZE = 10;
const ERROR_MAX_LENGTH = 300;

export type NotifyWinnersFailure =
  | "not_found"
  | "no_tracking"
  | "not_official"
  | "no_winners"
  | "missing_prize"
  | "empty_fixed_text"
  | "template_not_found"
  | "template_mismatch";

export type WinnerNoticeResult = { drawId: string; position: number; isSent: boolean; error?: string };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, ERROR_MAX_LENGTH) : "Falha no envio.";
}

/** O modelo vem da Meta, não da tela: o chat registra o texto que o ganhador recebe e a contagem de variáveis confere. */
async function findApprovedTemplate(trackingId: string, templateName: string, languageCode: string) {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: { metaAccessToken: true, metaPhoneNumberId: true, metaAppSecret: true, metaVerifyToken: true, metaBusinessAccountId: true },
  });
  if (!instance?.metaBusinessAccountId) return null;
  const credentials = decryptStoredMetaCredentialsPartial(instance);
  const response = await getMessageTemplates(credentials.accessToken, instance.metaBusinessAccountId);
  const template = response.data.find((option) => option.status === "APPROVED" && option.name === templateName && option.language === languageCode);
  return template ? summarizeTemplate(template) : null;
}

export async function notifyCampaignWinners(params: {
  organizationId: string;
  campaignId: string;
  templateName: string;
  languageCode: string;
  variables: WinnerVariable[];
  prizeNames: string[];
  actor: LoyaltyActor;
}) {
  const campaign = await prisma.loyaltyCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.organizationId },
    select: { id: true, name: true, trackingId: true },
  });
  if (!campaign) return { ok: false as const, reason: "not_found" as NotifyWinnersFailure, missingPositions: [] as number[] };
  if (!campaign.trackingId) return { ok: false as const, reason: "no_tracking" as NotifyWinnersFailure, missingPositions: [] };

  const resolved = await resolveOutboundProvider(campaign.trackingId).catch(() => null);
  if (!resolved || resolved.providerId !== "meta-cloud") return { ok: false as const, reason: "not_official" as NotifyWinnersFailure, missingPositions: [] };
  if (hasEmptyFixedText(params.variables)) return { ok: false as const, reason: "empty_fixed_text" as NotifyWinnersFailure, missingPositions: [] };

  const template = await findApprovedTemplate(campaign.trackingId, params.templateName, params.languageCode).catch(() => null);
  if (!template) return { ok: false as const, reason: "template_not_found" as NotifyWinnersFailure, missingPositions: [] };
  if (!template.sendable || template.headerVariableCount > 0 || template.bodyVariableCount !== params.variables.length) {
    return { ok: false as const, reason: "template_mismatch" as NotifyWinnersFailure, missingPositions: [] };
  }

  const pendingDraws = await prisma.loyaltyCampaignDraw.findMany({
    where: { campaignId: campaign.id, revokedAt: null, notifiedAt: null },
    orderBy: { position: "asc" },
    select: { id: true, position: true, code: true, memberName: true, memberPhone: true, memberId: true },
  });
  if (pendingDraws.length === 0) return { ok: false as const, reason: "no_winners" as NotifyWinnersFailure, missingPositions: [] };

  const winners = pendingDraws.map((draw) => ({ position: draw.position, code: draw.code, name: draw.memberName }));
  const missingPositions = positionsMissingPrize({ variables: params.variables, winners, prizeNames: params.prizeNames });
  if (missingPositions.length > 0) return { ok: false as const, reason: "missing_prize" as NotifyWinnersFailure, missingPositions };

  // Os nomes vêm da janela do aviso: ali a empresa decide o prêmio de cada posição, depois do sorteio.
  await prisma.loyaltyCampaign.update({ where: { id: campaign.id }, data: { prizeNames: params.prizeNames.map((name) => name.trim()) } });

  const memberIds = pendingDraws.map((draw) => draw.memberId).filter((memberId): memberId is string => Boolean(memberId));
  const members = await prisma.loyaltyMember.findMany({ where: { id: { in: memberIds } }, select: { id: true, lastLeadId: true } });
  const leadIdByMember = new Map(members.map((member) => [member.id, member.lastLeadId]));
  const leadIds = [...new Set([...leadIdByMember.values()].filter((leadId): leadId is string => Boolean(leadId)))];
  const conversations = await prisma.conversation.findMany({
    where: { trackingId: campaign.trackingId, leadId: { in: leadIds } },
    select: { id: true, leadId: true },
  });
  const conversationByLead = new Map(conversations.map((conversation) => [conversation.leadId, conversation.id]));
  const trackingId = campaign.trackingId;
  const campaignName = campaign.name;
  const provider = resolved.provider;
  const templateBody = template.bodyText;
  const templateHeader = template.headerText;

  async function notifyOne(draw: (typeof pendingDraws)[number]): Promise<WinnerNoticeResult> {
    // Reserva: só um envio por ganhador, e nunca para um sorteio revogado nesse meio-tempo.
    const claimed = await prisma.loyaltyCampaignDraw.updateMany({
      where: { id: draw.id, revokedAt: null, notifiedAt: null },
      data: { notifiedAt: new Date(), notifyError: null },
    });
    if (claimed.count === 0) return { drawId: draw.id, position: draw.position, isSent: false, error: "Já avisado ou revogado." };

    const values = winnerVariableValues({
      variables: params.variables,
      winner: { position: draw.position, code: draw.code, name: draw.memberName },
      campaignName,
      prizeNames: params.prizeNames,
    });

    // Cobra antes de enviar, como o modelo pelo chat: sem saldo, a mensagem não sai (spec 0148, RF-5).
    try {
      await chargeMessageOutbound({ organizationId: params.organizationId, userId: params.actor.userId ?? undefined, channel: "whatsapp", trackingId, mediaType: "text" });
    } catch (error) {
      const message = describeError(error);
      await prisma.loyaltyCampaignDraw.update({ where: { id: draw.id }, data: { notifiedAt: null, notifyError: message } });
      return { drawId: draw.id, position: draw.position, isSent: false, error: message };
    }

    let externalMessageId: string;
    try {
      const response = await provider.sendTemplate({
        kind: "template",
        to: normalizePhoneToMetaE164(draw.memberPhone),
        templateName: params.templateName,
        languageCode: params.languageCode,
        bodyParameters: values,
      });
      externalMessageId = response.externalMessageId;
    } catch (error) {
      const message = describeError(error);
      await prisma.loyaltyCampaignDraw.update({ where: { id: draw.id }, data: { notifiedAt: null, notifyError: message } });
      return { drawId: draw.id, position: draw.position, isSent: false, error: message };
    }

    // Daqui em diante a mensagem já saiu: falha só vai para o log, e o ganhador continua avisado.
    await prisma.loyaltyCampaignDraw
      .update({ where: { id: draw.id }, data: { notifyMessageId: externalMessageId } })
      .catch((error: unknown) => console.error("[star-friends] notify_message_id_failed", error));
    const leadId = draw.memberId ? leadIdByMember.get(draw.memberId) : null;
    const conversationId = leadId ? conversationByLead.get(leadId) : undefined;
    if (leadId && conversationId) {
      const body = renderTemplateBody(templateBody, values);
      await persistOutboundMessage({
        conversationId,
        leadId,
        trackingId,
        body: templateHeader ? `*${templateHeader}*\n\n${body}` : body,
        senderName: params.actor.name,
        externalMessageId,
      }).catch((error: unknown) => console.error("[star-friends] notify_persist_failed", error));
    }
    return { drawId: draw.id, position: draw.position, isSent: true };
  }

  const results: WinnerNoticeResult[] = [];
  for (let index = 0; index < pendingDraws.length; index += SEND_BATCH_SIZE) {
    results.push(...(await Promise.all(pendingDraws.slice(index, index + SEND_BATCH_SIZE).map(notifyOne))));
  }

  const sentCount = results.filter((result) => result.isSent).length;
  await auditLoyaltyAction({
    organizationId: params.organizationId,
    actor: params.actor,
    action: "campaign.winners_notified",
    actionLabel: `${campaign.name}: ${sentCount} de ${results.length} ganhador(es) avisado(s) pelo modelo "${params.templateName}"`,
    resourceId: campaign.id,
  });
  return { ok: true as const, sentCount, results };
}
