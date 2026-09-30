import "server-only";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { Prisma } from "@/generated/prisma/client";
import { LeadSource, MessageStatus } from "@/generated/prisma/enums";
import { waIdLookupVariants } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import { renderTemplateText } from "../../lib/template-variables";

/**
 * Espelha no chat do tracking o template que a campanha acabou de enviar
 * (spec 0052): acha ou cria o lead e a conversa do número e grava a mensagem
 * `fromMe` com o `wamid`, pra que o status (entregue/lido) e a resposta do
 * contato caiam na mesma conversa. Best-effort — nunca derruba o disparo.
 */

export interface BroadcastTemplateTexts {
  readonly headerText: string | null;
  readonly bodyText: string;
}

export interface RecordBroadcastChatMessageInput {
  readonly trackingId: string;
  readonly broadcastId: string;
  readonly broadcastName: string;
  readonly templateName: string;
  readonly templateTexts: BroadcastTemplateTexts;
  readonly recipient: {
    readonly id: string;
    readonly leadId: string | null;
    readonly name: string | null;
  };
  readonly sent: {
    readonly wamid: string;
    readonly waId: string;
    readonly headerParameters: string[];
    readonly bodyParameters: string[];
  };
}

const leadSelect = {
  id: true,
  phone: true,
  statusFlow: true,
  conversation: { select: { id: true } },
} satisfies Prisma.LeadSelect;

const messageInclude = {
  quotedMessage: true,
  conversation: { include: { lead: true } },
} satisfies Prisma.MessageInclude;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

export function renderBroadcastChatBody(
  templateTexts: BroadcastTemplateTexts,
  headerParameters: ReadonlyArray<string>,
  bodyParameters: ReadonlyArray<string>,
): string {
  const header = templateTexts.headerText
    ? renderTemplateText(templateTexts.headerText, headerParameters)
    : null;
  const body = renderTemplateText(templateTexts.bodyText, bodyParameters);
  return header ? `${header}\n\n${body}` : body;
}

async function findLeadByPhone(trackingId: string, waId: string) {
  return prisma.lead.findFirst({
    where: { trackingId, phone: { in: waIdLookupVariants(waId) } },
    select: leadSelect,
  });
}

/**
 * Lead novo nasce no primeiro status, `ACTIVE` e sem automações de lead novo:
 * ninguém pediu atendimento ainda, e disparar workflows/rodízio pra milhares de
 * contatos de uma vez seria efeito colateral de campanha (spec 0052, D-2).
 */
async function createBroadcastLead(
  trackingId: string,
  waId: string,
  name: string | null,
) {
  const firstStatus = await prisma.status.findFirst({
    where: { trackingId },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  if (!firstStatus) return null;

  const topLead = await prisma.lead.findFirst({
    where: { statusId: firstStatus.id },
    select: { order: true },
    orderBy: { order: "asc" },
  });

  try {
    return await prisma.lead.create({
      data: {
        name: name?.trim() || waId,
        phone: waId,
        trackingId,
        statusId: firstStatus.id,
        source: LeadSource.WHATSAPP,
        order: topLead ? Number(topLead.order) - 1 : 0,
        statusFlow: "ACTIVE",
      },
      select: leadSelect,
    });
  } catch (error) {
    // Resposta do contato criou o lead no meio do caminho — usa o dele.
    if (isUniqueViolation(error)) return findLeadByPhone(trackingId, waId);
    throw error;
  }
}

async function resolveConversationId(
  trackingId: string,
  lead: { id: string; phone: string | null; conversation: { id: string } | null },
  waId: string,
): Promise<string | null> {
  if (lead.conversation) return lead.conversation.id;

  const phone = lead.phone || waId;
  try {
    const conversation = await prisma.conversation.upsert({
      where: { leadId_trackingId: { leadId: lead.id, trackingId } },
      create: {
        trackingId,
        leadId: lead.id,
        remoteJid: `${phone}@s.whatsapp.net`,
        isActive: true,
      },
      update: {},
      select: { id: true },
    });
    return conversation.id;
  } catch (error) {
    // Já existe conversa com esse remoteJid presa a outro lead — não mexe.
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export async function recordBroadcastChatMessage(
  input: RecordBroadcastChatMessageInput,
): Promise<void> {
  const { trackingId, sent } = input;

  const lead =
    (await findLeadByPhone(trackingId, sent.waId)) ??
    (await createBroadcastLead(trackingId, sent.waId, input.recipient.name));
  if (!lead) {
    console.warn("[campanhas] chat: tracking sem status, mensagem não espelhada", {
      trackingId,
      broadcastId: input.broadcastId,
    });
    return;
  }

  if (!input.recipient.leadId) {
    await prisma.broadcastRecipient.update({
      where: { id: input.recipient.id },
      data: { leadId: lead.id },
    });
  }

  const conversationId = await resolveConversationId(trackingId, lead, sent.waId);
  if (!conversationId) {
    console.warn("[campanhas] chat: conversa em conflito, mensagem não espelhada", {
      trackingId,
      leadId: lead.id,
    });
    return;
  }

  const message = await prisma.message.upsert({
    where: { messageId: sent.wamid },
    update: {},
    create: {
      conversationId,
      messageId: sent.wamid,
      body: renderBroadcastChatBody(
        input.templateTexts,
        sent.headerParameters,
        sent.bodyParameters,
      ),
      fromMe: true,
      status: MessageStatus.SENT,
      senderName: `Campanha · ${input.broadcastName}`,
      metadata: {
        source: "broadcast",
        broadcastId: input.broadcastId,
        templateName: input.templateName,
      },
    },
    include: messageInclude,
  });

  // Condicional: se o contato respondeu entre o upsert e aqui, a resposta já
  // é a última mensagem e não pode ser rebaixada pela da campanha.
  await prisma.conversation.updateMany({
    where: {
      id: conversationId,
      OR: [
        { lastMessageId: null },
        { lastMessage: { is: { createdAt: { lte: message.createdAt } } } },
      ],
    },
    data: { lastMessageId: message.id, lastMessageAt: message.createdAt },
  });

  // Conversa finalizada fica fora da lista padrão do chat, e o client só a
  // reabre se já estiver no cache — reabre aqui pra mensagem aparecer.
  if (lead.statusFlow === "FINISHED") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { statusFlow: "ACTIVE" },
    });
  }

  // Sem `conversation:new`: ele toca som no client, e uma campanha grande
  // viraria milhares de notificações. O `message:new` do tracking já faz a
  // lista buscar a conversa que ainda não conhece.
  try {
    await pusherServer.trigger(conversationId, "message:new", message);
    await pusherServer.trigger(trackingId, "message:new", message);
  } catch (error) {
    console.warn("[campanhas] chat: pusher falhou", error);
  }
}
