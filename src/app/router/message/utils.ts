import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { NodeType } from "@/generated/prisma/enums";
import { dispatchFirstChatInteraction } from "@/inngest/utils";

/**
 * Atualiza `Conversation.lastMessage` + `lastMessageAt` pra refletir a
 * mensagem mais recente da conversa. Fundamental pra sidebar mostrar
 * preview correto da última mensagem ("Foto", "Mensagem apagada", etc).
 *
 * Antes só o webhook chamava isso (via `connect`); agora todas as
 * procedures de envio (create text/image/file/audio/sticker/location/
 * contact) chamam aqui pra manter consistência mesmo quando a mensagem
 * é outbound (atendente → lead).
 *
 * Fire-and-forget — se falhar, loga warn mas não derruba o fluxo de
 * envio (a mensagem já foi salva).
 */
export async function updateConversationLastMessage(
  conversationId: string,
  messageId: string,
  createdAt?: Date,
) {
  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: { connect: { id: messageId } },
        lastMessageAt: createdAt ?? new Date(),
      },
    });
  } catch (err) {
    console.warn(
      "[updateConversationLastMessage] failed",
      conversationId,
      messageId,
      err,
    );
  }
}

export async function attendLeadIfWaiting(leadId: string, userId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, statusFlow: true },
  });

  if (!lead || lead.statusFlow === "ACTIVE" || lead.statusFlow === "FINISHED") return;

  await prisma.lead.update({
    where: { id: lead.id },
    data: { statusFlow: "ACTIVE" },
  });
}

// Disparado em toda mensagem outbound do atendente humano: pausa a IA
// (isActive=false, mesmo mecanismo do tool transfer_to_human) e atribui o
// atendente como responsável do lead. Sobrescreve responsável existente:
// último que respondeu vira o dono. Fast-path quando já está nesse estado.
export async function claimLeadForAttendant(leadId: string, userId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      isActive: true,
      responsibleId: true,
      trackingId: true,
    },
  });

  if (!lead) return;

  if (!lead.isActive && lead.responsibleId === userId) return;

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      isActive: false,
      responsibleId: userId,
    },
  });

  await pusherServer.trigger(lead.trackingId, "lead:updated", {
    leadId: lead.id,
  });
}

const URL_REGEX = /https?:\/\/\S+/i;

export async function logChatMessageSent(params: {
  organizationId: string | null | undefined;
  conversationId: string;
  channel: string;
  user: { id: string; name: string; email: string; image?: string | null };
  messageId: string;
  body: string;
  mediaType?: "audio" | "image" | "file" | "text";
  leadId: string;
  leadName: string;
}) {
  if (!params.organizationId) return;
  const hasLink = URL_REGEX.test(params.body ?? "");
  const baseLog = {
    organizationId: params.organizationId,
    userId: params.user.id,
    userName: params.user.name,
    userEmail: params.user.email,
    userImage: params.user.image,
    appSlug: "chat",
    subAppSlug: "tracking-chat",
    resource: "message",
    resourceId: params.messageId,
    metadata: {
      conversationId: params.conversationId,
      channel: params.channel,
      leadId: params.leadId,
      leadName: params.leadName,
      length: (params.body ?? "").length,
      mediaType: params.mediaType ?? "text",
      hasLink,
    },
  };
  await logActivity({
    ...baseLog,
    action: "message.sent",
    actionLabel: `Enviou mensagem para "${params.leadName}"`,
    featureKey:
      params.mediaType && params.mediaType !== "text"
        ? `chat.${params.mediaType}.sent`
        : "chat.message.sent",
  });
  if (hasLink) {
    await logActivity({
      ...baseLog,
      action: "link.sent",
      actionLabel: `Enviou link para "${params.leadName}"`,
      featureKey: "chat.link.sent",
    });
  }
}

// Dispara o gatilho FIRST_CHAT_INTERACTION na 1ª mensagem do usuário do app
// (fromMe=true) numa conversa. Atomicidade via updateMany condicional:
// `firstUserMessageAt: null` é a guarda — só uma transação pode passar de
// NULL → Date. Em envios concorrentes, o Postgres serializa o UPDATE e apenas
// uma chamada recebe `count: 1`; as demais recebem `0` e saem sem custo extra.
//
// Caminho quente (mensagens 2..N): 1 UPDATE indexado por PK que não casa o
// WHERE → retorno imediato. Sem COUNT, sem JOIN, sem ler `messages`.
export async function triggerFirstChatInteractionIfFirst(params: {
  conversationId: string;
  leadId: string;
}) {
  const { count } = await prisma.conversation.updateMany({
    where: { id: params.conversationId, firstUserMessageAt: null },
    data: { firstUserMessageAt: new Date() },
  });

  if (count === 0) return;

  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      statusId: true,
      trackingId: true,
      responsibleId: true,
      isActive: true,
    },
  });

  if (!lead) return;

  const workflows = await prisma.workflow.findMany({
    where: {
      trackingId: lead.trackingId,
      isActive: true,
      nodes: { some: { type: NodeType.FIRST_CHAT_INTERACTION } },
    },
    select: { id: true },
  });

  if (workflows.length === 0) return;

  await Promise.all(
    workflows.map((workflow) =>
      dispatchFirstChatInteraction({
        workflowId: workflow.id,
        lead,
      }),
    ),
  );
}
