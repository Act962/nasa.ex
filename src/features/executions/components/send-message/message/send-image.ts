import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { sendMedia } from "@/http/uazapi/send-media";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

interface SendImageMessageProps {
  conversationId: string;
  body: string;
  leadPhone: string;
  token: string;
  mediaUrl: string;
}

export const sendImageMessage = async (params: SendImageMessageProps) => {
  const response = await sendMedia(params.token, {
    file: useConstructUrl(params.mediaUrl),
    text: params.body,
    number: params.leadPhone,
    delay: 2000,
    type: "image",
    readchat: true,
    readmessages: true,
  });

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      body: params.body,
      mediaUrl: params.mediaUrl,
      mimetype: "image/jpeg",
      messageId: response.id,
      fromMe: true,
      status: MessageStatus.SENT,
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
