// Vídeo do bloco Enviar mensagem do FlowAstro (spec 0141). O WhatsApp aceita MP4 ou 3GP de até 16 MB.
import { CreatedMessageProps, MessageStatus } from "@/features/tracking-chat/types";
import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers";
import { useConstructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { sendWithWorkflowErrors, WORKFLOW_TYPING_DELAY_MS } from "../../../lib/workflow-outbound";
import { flowOriginMetadata, type FlowMessageOrigin } from "@/features/workflows/lib/flow-origin";

function videoMimetypeOf(mediaUrl: string): string {
  return mediaUrl.toLowerCase().endsWith(".3gp") ? "video/3gpp" : "video/mp4";
}

interface SendVideoMessageProps {
  conversationId: string;
  body: string;
  leadPhone: string;
  provider: WhatsAppChatProvider;
  mediaUrl: string;
  origin?: FlowMessageOrigin | null;
}

export const sendVideoMessage = async (params: SendVideoMessageProps) => {
  const mimetype = videoMimetypeOf(params.mediaUrl);
  const sent = await sendWithWorkflowErrors(() =>
    params.provider.sendMedia({
      kind: "media",
      mediaKind: "video",
      to: params.leadPhone,
      mediaUrl: useConstructUrl(params.mediaUrl),
      mimetype,
      caption: params.body || undefined,
      typingDelayMs: WORKFLOW_TYPING_DELAY_MS,
    }),
  );

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      body: params.body,
      mediaUrl: params.mediaUrl,
      mimetype,
      messageId: sent.externalMessageId,
      fromMe: true,
      status: MessageStatus.SENT,
      ...(params.origin ? { metadata: flowOriginMetadata(params.origin) } : {}),
    },
    include: { conversation: { include: { lead: true } } },
  });
  const messageCreated: CreatedMessageProps = { ...message, currentUserId: "" };
  await pusherServer.trigger(message.conversationId, "message:created", messageCreated);
};
