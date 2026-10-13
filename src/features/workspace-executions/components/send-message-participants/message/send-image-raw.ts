import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers";
import { useConstructUrl } from "@/hooks/use-construct-url";

interface Params {
  body: string;
  number: string;
  provider: WhatsAppChatProvider;
  mediaUrl: string;
}

export const sendImageRaw = async ({
  body,
  number,
  provider,
  mediaUrl,
}: Params) => {
  return await provider.sendMedia({
    kind: "media",
    mediaKind: "image",
    to: number,
    mediaUrl: useConstructUrl(mediaUrl),
    caption: body || undefined,
    typingDelayMs: 2000,
  });
};
