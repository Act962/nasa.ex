import z from "zod";

export interface ForwardContext {
  conversationId: string;
  number: string;
  token: string;
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
