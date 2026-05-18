import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { MessageStatus } from "@/features/tracking-chat/types";

interface PersistArgs {
  conversationId: string;
  leadId: string;
  trackingId: string;
  body: string | null;
  senderName: string;
  externalMessageId: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaCaption?: string | null;
  mimetype?: string | null;
  fileName?: string | null;
}

export async function persistOutboundMessage(args: PersistArgs) {
  const now = new Date();

  const message = await prisma.message.create({
    data: {
      conversationId: args.conversationId,
      messageId: args.externalMessageId,
      fromMe: true,
      status: MessageStatus.SENT,
      body: args.body,
      senderName: args.senderName,
      mediaUrl: args.mediaUrl ?? null,
      mediaType: args.mediaType ?? null,
      mediaCaption: args.mediaCaption ?? null,
      mimetype: args.mimetype ?? null,
      fileName: args.fileName ?? null,
      createdAt: now,
    },
    include: {
      quotedMessage: true,
      conversation: { include: { lead: true } },
    },
  });

  await prisma.conversation.update({
    where: {
      leadId_trackingId: {
        leadId: args.leadId,
        trackingId: args.trackingId,
      },
    },
    data: {
      lastMessage: { connect: { id: message.id } },
      lead: {
        update: {
          updatedAt: now,
          lastOutboundAt: now,
        },
      },
    },
  });

  await pusherServer.trigger(args.conversationId, "message:new", message);
  await pusherServer.trigger(args.trackingId, "message:new", message);

  return message;
}
