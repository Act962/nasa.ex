import z from "zod";
import type { WhatsAppChatProvider } from "@/features/tracking-chat/lib/providers";

export interface ForwardContext {
  conversationId: string;
  number: string;
  /**
   * Provider resolvido por-tracking (Fase 6). As strategies despacham via
   * `provider.sendText/sendMedia/sendLocation/sendContact` em vez de
   * chamar `@/http/uazapi/*` direto. Compatível com Uazapi e Meta Cloud
   * sem mudança em call sites.
   */
  provider: WhatsAppChatProvider;
  senderName: string;
}

export interface ForwardedMessage {
  id: string;
  messageId: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mimetype: string | null;
  fileName: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
}

export interface ForwardStrategy<P> {
  kind: string;
  schema: z.ZodObject<z.ZodRawShape>;
  execute(payload: P, ctx: ForwardContext): Promise<ForwardedMessage>;
}

export const MESSAGE_SELECT = {
  id: true,
  messageId: true,
  body: true,
  mediaUrl: true,
  mediaType: true,
  mimetype: true,
  fileName: true,
  latitude: true,
  longitude: true,
  createdAt: true,
} as const;
