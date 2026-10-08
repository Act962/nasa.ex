import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers";

interface Params {
  body: string;
  number: string;
  provider: WhatsAppChatProvider;
}

export const sendTextRaw = async ({ body, number, provider }: Params) => {
  return await provider.sendText({
    kind: "text",
    to: number,
    body,
    typingDelayMs: 2000,
  });
};
