import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface Params {
  body: string;
  number: string;
  provider: WhatsAppChatProvider;
  mediaUrl: string;
  fileName: string;
}

export const sendDocumentRaw = async ({
  body,
  number,
  provider,
  mediaUrl,
  fileName,
}: Params) => {
  return await provider.sendMedia({
    kind: "media",
    mediaKind: "document",
    to: number,
    mediaUrl: useConstructUrl(mediaUrl),
    caption: body || undefined,
    fileName,
    typingDelayMs: 2000,
  });
};
