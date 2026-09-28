import "server-only";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { updateConversationLastMessage } from "@/app/router/message/utils";
import { normalizeWhatsappPhoneBr } from "@/features/trafego/lib/phone";

/** Garante a Conversation canônica do lead usado pela operação trafeGO. */
export async function ensureTrafegoConversation({
  leadId,
  trackingId,
  phone,
}: {
  leadId: string;
  trackingId: string;
  phone: string | null | undefined;
}) {
  const existing = await prisma.conversation.findUnique({
    where: { leadId },
    select: { id: true },
  });
  if (existing) return existing;

  const normalizedPhone = normalizeWhatsappPhoneBr(phone) ?? leadId;
  return prisma.conversation.create({
    data: {
      remoteJid: `${normalizedPhone}@s.whatsapp.net`,
      trackingId,
      leadId,
      isActive: true,
    },
    select: { id: true },
  });
}

/** Registra uma nota de sistema no chat, sem qualquer envio para WhatsApp. */
export async function recordTrafegoSystemMessage({
  leadId,
  trackingId,
  phone,
  body,
}: {
  leadId: string;
  trackingId: string;
  phone: string | null | undefined;
  body: string;
}) {
  const conversation = await ensureTrafegoConversation({ leadId, trackingId, phone });
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body,
      messageId: `trafego-system-${randomUUID()}`,
      fromMe: true,
      status: "SENT",
      senderName: "trafeGO",
      metadata: { source: "trafego_system" },
    },
    select: { id: true, createdAt: true },
  });
  await updateConversationLastMessage(conversation.id, message.id, message.createdAt);
  return { conversationId: conversation.id, messageId: message.id };
}

/** Persiste uma saída real de WhatsApp na mesma Conversation do lead. */
export async function persistTrafegoOutboundMessage({
  leadId,
  trackingId,
  phone,
  body,
  externalMessageId,
}: {
  leadId: string;
  trackingId: string;
  phone: string | null | undefined;
  body: string;
  externalMessageId: string;
}) {
  const conversation = await ensureTrafegoConversation({ leadId, trackingId, phone });
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      body,
      messageId: externalMessageId,
      fromMe: true,
      status: "SENT",
      senderName: "trafeGO",
    },
    select: {
      id: true,
      messageId: true,
      body: true,
      createdAt: true,
      fromMe: true,
      status: true,
      conversationId: true,
      senderName: true,
    },
  });
  await updateConversationLastMessage(conversation.id, message.id, message.createdAt);
  await pusherServer
    .trigger(conversation.id, "message:created", { ...message, currentUserId: null })
    .catch(() => {});
}
