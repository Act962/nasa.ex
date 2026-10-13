import {
  CreatedMessageProps,
  MessageStatus,
} from "@/features/tracking-chat/types";
import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers";
import { useConstructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import {
  sendWithWorkflowErrors,
  WORKFLOW_TYPING_DELAY_MS,
} from "../../../lib/workflow-outbound";

interface SendDocumentMessageProps {
  conversationId: string;
  body: string;
  leadPhone: string;
  provider: WhatsAppChatProvider;
  mediaUrl: string;
  fileName: string;
}

export const sendDocumentMessage = async (params: SendDocumentMessageProps) => {
  const sent = await sendWithWorkflowErrors(() =>
    params.provider.sendMedia({
      kind: "media",
      mediaKind: "document",
      to: params.leadPhone,
      mediaUrl: useConstructUrl(params.mediaUrl),
      caption: params.body || undefined,
      fileName: params.fileName,
      typingDelayMs: WORKFLOW_TYPING_DELAY_MS,
    }),
  );

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      body: params.body,
      mediaUrl: params.mediaUrl,
      messageId: sent.externalMessageId,
      fromMe: true,
      fileName: params.fileName,
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
