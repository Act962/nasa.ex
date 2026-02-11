import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { markReadMessage } from "@/http/uazapi/mark-read-message";
import { sendText } from "@/http/uazapi/send-text";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

interface SendTextMessageProps {
  body: string;
  conversationId: string;
  leadPhone: string;
  token: string;
}

export const sendTextMessage = async ({
  body,
  conversationId,
  leadPhone,
  token,
}: SendTextMessageProps) => {
  const response = await sendText(token, {
    text: body,
    number: leadPhone,
    delay: 2000,
  });

  const message = await prisma.message.create({
    data: {
      conversationId: conversationId,
      body: body,
      messageId: response.messageid,
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
