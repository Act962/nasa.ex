import { z } from "zod";

export const webhookBaseSchema = z
  .object({
    EventType: z.string().min(1),
    token: z.string().optional(),
  })
  .passthrough();

export const messagesEventSchema = z
  .object({
    EventType: z.literal("messages"),
    message: z
      .object({
        chatid: z.string().min(1),
        fromMe: z.boolean().optional().default(false),
        senderName: z.string().optional(),
        content: z.unknown().optional(),
        messageType: z.string().optional(),
      })
      .passthrough(),
    chat: z.object({ name: z.string().optional() }).passthrough().optional(),
    token: z.string().optional(),
  })
  .passthrough();

export const chatLabelsEventSchema = z
  .object({
    EventType: z.literal("chat_labels"),
    message: z.object({ chatid: z.string().min(1) }).passthrough(),
    chat: z.object({ wa_label: z.array(z.string()).optional() }).passthrough(),
  })
  .passthrough();

export type WebhookBase = z.infer<typeof webhookBaseSchema>;
export type MessagesEvent = z.infer<typeof messagesEventSchema>;
export type ChatLabelsEvent = z.infer<typeof chatLabelsEventSchema>;
