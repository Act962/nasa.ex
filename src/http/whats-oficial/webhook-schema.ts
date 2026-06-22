import { z } from "zod";

/**
 * Schemas Zod do webhook da WhatsApp Cloud API.
 *
 * Parseia o **body cru** que a Meta entrega no POST do webhook
 * (`{ object: "whatsapp_business_account", entry: [...] }`).
 *
 * Para os JSONs capturados em `jsons/webhooks/*.json` (que vêm do n8n no
 * formato `[{ headers, body, ... }]`), use `unwrapCapturedFixture` antes de
 * chamar `parseWhatsAppOfficialWebhook`.
 *
 * Espelha `src/http/uazapi/webhook-schema.ts` (formato Uazapi).
 */

// ──────────────────────────────────────────────────────────────────────────
// Bloco "value" comum
// ──────────────────────────────────────────────────────────────────────────

const metadataSchema = z.object({
  display_phone_number: z.string(),
  phone_number_id: z.string(),
});

const inboundContactSchema = z.object({
  profile: z.object({ name: z.string().optional() }).optional(),
  wa_id: z.string(),
  user_id: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────────────────
// Mídia inbound (image/audio/document/sticker/video) — campos comuns
// ──────────────────────────────────────────────────────────────────────────

const mediaCommonSchema = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  url: z.string().optional(),
});

const imageMediaSchema = mediaCommonSchema.extend({
  caption: z.string().optional(),
});

const documentMediaSchema = mediaCommonSchema.extend({
  caption: z.string().optional(),
  filename: z.string().optional(),
});

const audioMediaSchema = mediaCommonSchema.extend({
  voice: z.boolean().optional(),
});

const stickerMediaSchema = mediaCommonSchema.extend({
  animated: z.boolean().optional(),
});

const videoMediaSchema = mediaCommonSchema.extend({
  caption: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────────────────
// Tipos de mensagem inbound (campos comuns)
// ──────────────────────────────────────────────────────────────────────────

const messageBaseFields = {
  from: z.string(),
  from_user_id: z.string().optional(),
  id: z.string(),
  timestamp: z.string(),
  context: z
    .object({
      from: z.string().optional(),
      id: z.string().optional(),
      forwarded: z.boolean().optional(),
      frequently_forwarded: z.boolean().optional(),
    })
    .optional(),
  referral: z.unknown().optional(),
};

const textMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("text"),
  text: z.object({ body: z.string() }),
});

const imageMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("image"),
  image: imageMediaSchema,
});

const audioMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("audio"),
  audio: audioMediaSchema,
});

const documentMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("document"),
  document: documentMediaSchema,
});

const stickerMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("sticker"),
  sticker: stickerMediaSchema,
});

const videoMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("video"),
  video: videoMediaSchema,
});

const locationMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("location"),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
    address: z.string().optional(),
    url: z.string().optional(),
  }),
});

const contactsMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("contacts"),
  contacts: z.array(z.record(z.string(), z.unknown())),
});

const buttonMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("button"),
  button: z.object({ payload: z.string().optional(), text: z.string() }),
});

const interactiveMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("interactive"),
  interactive: z.record(z.string(), z.unknown()),
});

const reactionMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("reaction"),
  reaction: z.object({ message_id: z.string(), emoji: z.string().optional() }),
});

const systemMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("system"),
  system: z.record(z.string(), z.unknown()),
});

const unsupportedMessageSchema = z.object({
  ...messageBaseFields,
  type: z.literal("unsupported"),
  errors: z.array(z.record(z.string(), z.unknown())).optional(),
});

/**
 * União discriminada por `type`. Cobre os tipos que aparecem nos fixtures
 * capturados (text/image/audio/document/sticker) + os demais documentados.
 */
const inboundMessageSchema = z.discriminatedUnion("type", [
  textMessageSchema,
  imageMessageSchema,
  audioMessageSchema,
  documentMessageSchema,
  stickerMessageSchema,
  videoMessageSchema,
  locationMessageSchema,
  contactsMessageSchema,
  buttonMessageSchema,
  interactiveMessageSchema,
  reactionMessageSchema,
  systemMessageSchema,
  unsupportedMessageSchema,
]);

// ──────────────────────────────────────────────────────────────────────────
// Statuses (sent/delivered/read/failed)
// ──────────────────────────────────────────────────────────────────────────

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string(),
  recipient_id: z.string(),
  conversation: z
    .object({
      id: z.string(),
      origin: z.object({ type: z.string() }).optional(),
    })
    .optional(),
  errors: z.array(z.record(z.string(), z.unknown())).optional(),
});

// ──────────────────────────────────────────────────────────────────────────
// Envelope
// ──────────────────────────────────────────────────────────────────────────

const valueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: metadataSchema,
  contacts: z.array(inboundContactSchema).optional(),
  messages: z.array(inboundMessageSchema).optional(),
  statuses: z.array(statusSchema).optional(),
  errors: z.array(z.record(z.string(), z.unknown())).optional(),
});

const changeSchema = z.object({
  field: z.string(),
  value: valueSchema,
});

const entrySchema = z.object({
  id: z.string(),
  changes: z.array(changeSchema),
});

export const whatsAppOfficialWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(entrySchema),
});

export type WhatsAppOfficialWebhook = z.infer<
  typeof whatsAppOfficialWebhookSchema
>;
export type WhatsAppOfficialInboundMessage = z.infer<
  typeof inboundMessageSchema
>;
export type WhatsAppOfficialStatus = z.infer<typeof statusSchema>;
export type WhatsAppOfficialMetadata = z.infer<typeof metadataSchema>;
export type WhatsAppOfficialContact = z.infer<typeof inboundContactSchema>;

/**
 * Parse seguro do body do webhook. Retorna `null` se inválido (não lança).
 */
export function parseWhatsAppOfficialWebhook(
  raw: unknown,
): WhatsAppOfficialWebhook | null {
  const result = whatsAppOfficialWebhookSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Os JSONs em `jsons/webhooks/*.json` foram capturados via n8n no formato
 * `[{ headers, params, query, body, webhookUrl, executionMode }]`. Esta
 * função aceita esse envelope e devolve o `body` real (igual ao que a Meta
 * envia direto pro nosso endpoint). Também aceita o body puro (passa direto).
 */
export function unwrapCapturedFixture(raw: unknown): unknown {
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as Record<string, unknown> | undefined;
    if (first && typeof first === "object" && "body" in first) {
      return first.body;
    }
  }
  if (raw && typeof raw === "object" && "body" in (raw as object)) {
    const maybeBody = (raw as Record<string, unknown>).body;
    if (
      maybeBody &&
      typeof maybeBody === "object" &&
      "object" in (maybeBody as object)
    ) {
      return maybeBody;
    }
  }
  return raw;
}
