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

/**
 * Evento de chamada do WhatsApp (uazapi).
 *
 * O uazapi entrega chamadas via `EventType: "calls"` com payload variável
 * dependendo da versão. O schema é PERMISSIVO (passthrough) — extraímos
 * só o essencial e logamos o resto pra ajustar se o formato mudar.
 *
 * Status comuns observados:
 *  - `"offer"` / `"ringing"` — chamada recebida (toque)
 *  - `"accept"` / `"answered"` — atendida
 *  - `"reject"` / `"declined"` — recusada pelo destinatário
 *  - `"terminate"` / `"hangup"` / `"timeout"` — encerrada
 *  - `"missed"` — perdida (não atendida)
 */
export const callsEventSchema = z
  .object({
    EventType: z.literal("calls"),
    call: z
      .object({
        id: z.string().optional(),
        callid: z.string().optional(),
        chatid: z.string().optional(),
        from: z.string().optional(),
        fromMe: z.boolean().optional(),
        isVideo: z.boolean().optional(),
        status: z.string().optional(),
        duration: z.number().optional(),
        timestamp: z.number().optional(),
      })
      .passthrough()
      .optional(),
    token: z.string().optional(),
  })
  .passthrough();

export type WebhookBase = z.infer<typeof webhookBaseSchema>;
export type MessagesEvent = z.infer<typeof messagesEventSchema>;
export type ChatLabelsEvent = z.infer<typeof chatLabelsEventSchema>;
export type CallsEvent = z.infer<typeof callsEventSchema>;
