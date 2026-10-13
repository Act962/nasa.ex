import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import {
  sendWithWorkflowErrors,
  toStoredMessageId,
  WORKFLOW_TYPING_DELAY_MS,
} from "../../../lib/workflow-outbound";

interface SendTextMessageProps {
  body: string;
  conversationId: string;
  leadPhone: string;
  provider: WhatsAppChatProvider;
}

export const sendTextMessage = async ({
  body,
  conversationId,
  leadPhone,
  provider,
}: SendTextMessageProps) => {
  const sent = await sendWithWorkflowErrors(() =>
    provider.sendText({
      kind: "text",
      to: leadPhone,
      body,
      typingDelayMs: WORKFLOW_TYPING_DELAY_MS,
    }),
  );

  const message = await prisma.message.create({
    data: {
      conversationId: conversationId,
      body: body,
      messageId: toStoredMessageId(sent),
      fromMe: true,
      status: MessageStatus.SENT,
      quotedMessageId: null,
    },
    include: {
      conversation: {
        include: {
          lead: true,
        },
      },
    },
  });
  const messageCreated: CreatedMessageProps = {
    ...message,
    currentUserId: "",
  };
  await pusherServer.trigger(
    message.conversationId,
    "message:created",
    messageCreated,
  );
};
