// Áudio do bloco Enviar mensagem do FlowAstro (spec 0141). OGG/Opus vai como mensagem de voz; os outros, como áudio.
import { CreatedMessageProps, MessageStatus } from "@/features/tracking-chat/types";
import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers";
import { useConstructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { sendWithWorkflowErrors, WORKFLOW_TYPING_DELAY_MS } from "../../../lib/workflow-outbound";
import { flowOriginMetadata, type FlowMessageOrigin } from "@/features/workflows/lib/flow-origin";

const AUDIO_MIMETYPE_BY_EXTENSION: Record<string, string> = {
  aac: "audio/aac",
  amr: "audio/amr",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  opus: "audio/ogg",
};

function audioMimetypeOf(fileName: string): string | undefined {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_MIMETYPE_BY_EXTENSION[extension];
}

interface SendAudioMessageProps {
  conversationId: string;
  leadPhone: string;
  provider: WhatsAppChatProvider;
  mediaUrl: string;
  fileName: string;
  origin?: FlowMessageOrigin | null;
}

export const sendAudioMessage = async (params: SendAudioMessageProps) => {
  const mimetype = audioMimetypeOf(params.fileName || params.mediaUrl);
  const sent = await sendWithWorkflowErrors(() =>
    params.provider.sendMedia({
      kind: "media",
      mediaKind: "audio",
      to: params.leadPhone,
      mediaUrl: useConstructUrl(params.mediaUrl),
      mimetype,
      isVoice: mimetype === "audio/ogg",
      typingDelayMs: WORKFLOW_TYPING_DELAY_MS,
    }),
  );

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      body: "",
      mediaUrl: params.mediaUrl,
      mimetype: mimetype ?? null,
      messageId: sent.externalMessageId,
      fromMe: true,
      fileName: params.fileName || null,
      status: MessageStatus.SENT,
      ...(params.origin ? { metadata: flowOriginMetadata(params.origin) } : {}),
    },
    include: { conversation: { include: { lead: true } } },
  });
  const messageCreated: CreatedMessageProps = { ...message, currentUserId: "" };
  await pusherServer.trigger(message.conversationId, "message:created", messageCreated);
};
