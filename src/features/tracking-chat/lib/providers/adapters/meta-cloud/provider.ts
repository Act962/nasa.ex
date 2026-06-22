/**
 * OfficialProvider — adapter da PORT `WhatsAppChatProvider` em cima do
 * cliente HTTP cru da WhatsApp Business Cloud API
 * (`src/http/whats-oficial/*`, entregue na Fase 1).
 *
 * Mapeamento canônico ↔ Meta:
 *  - `to` canônico (E.164 sem `+`) ↔ formato da Meta (idêntico).
 *  - Mídia: prefere `mediaId` (uploadado via `uploadOfficialMedia`); se vier
 *    só `mediaUrl`, manda como `{ link }`.
 *  - `mediaKind` canônico mapeia 1:1 com `OutboundMediaKind` da Meta
 *    (`image|audio|document|sticker|video`).
 *  - Webhook inbound: usa o schema Zod já existente
 *    (`whatsAppOfficialWebhookSchema`) e desempacota o array
 *    `entry[].changes[].value.messages[]` em mensagens canônicas.
 *  - `verifyWebhook` delega pra `isMetaSignatureValid` (HMAC-SHA256 do raw
 *    body com `appSecret`).
 *
 * Como na Fase 1, ZERO efeito em produção — esta classe só vai ser usada
 * a partir da Fase 5 (webhook oficial) e Fase 6 (envio via factory).
 */
import "server-only";
import { z } from "zod";

import {
  isMetaSignatureValid,
  parseWhatsAppOfficialWebhook,
  sendOfficialContact,
  sendOfficialLocation,
  sendOfficialMedia,
  sendOfficialText,
  type WhatsAppOfficialInboundMessage,
  type WhatsAppOfficialMetadata,
  type WhatsAppOfficialStatus,
} from "@/http/whats-oficial";

import { registerProvider } from "../../factory";
import { ProviderSendInvalidResponseError } from "../../outbound-errors";
import { normalizePhoneToMetaE164 } from "./normalize-phone";
import type {
  CanonicalInboundMessage,
  CanonicalInboundStatusUpdate,
  CanonicalMediaKind,
  NormalizedInbound,
  ProviderBuilder,
  ProviderConfig,
  ProviderWebhookHeaders,
  SendCanonicalContact,
  SendCanonicalLocation,
  SendCanonicalMedia,
  SendCanonicalText,
  SendResult,
  WhatsAppChatProvider,
} from "../../types";

// ────────────────────────────────────────────────────────────────────────────
// Config concreta da Meta Cloud
// ────────────────────────────────────────────────────────────────────────────

const metaCloudConfigSchema = z.object({
  accessToken: z.string().min(1, "meta accessToken obrigatório"),
  phoneNumberId: z.string().min(1, "meta phoneNumberId obrigatório"),
  /**
   * App Secret — usado pra validar a assinatura `x-hub-signature-256` do
   * webhook. Opcional (alguns ambientes podem rodar sem validação em dev),
   * mas em produção é fortemente recomendado.
   */
  appSecret: z.string().optional(),
});

export type MetaCloudProviderConfig = z.infer<typeof metaCloudConfigSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Mapeamento canônico ↔ Meta
// ────────────────────────────────────────────────────────────────────────────

function toMetaMediaKind(kind: CanonicalMediaKind) {
  // 1:1 — a Meta usa as mesmas 5 categorias.
  return kind;
}

function metaTypeToCanonicalKind(
  type: WhatsAppOfficialInboundMessage["type"],
): { type: CanonicalInboundMessage["type"]; mediaKind?: CanonicalMediaKind } {
  switch (type) {
    case "text":
      return { type: "text" };
    case "image":
      return { type: "media", mediaKind: "image" };
    case "video":
      return { type: "media", mediaKind: "video" };
    case "audio":
      return { type: "media", mediaKind: "audio" };
    case "document":
      return { type: "media", mediaKind: "document" };
    case "sticker":
      return { type: "media", mediaKind: "sticker" };
    case "location":
      return { type: "location" };
    case "contacts":
      return { type: "contact" };
    case "reaction":
      return { type: "reaction" };
    case "interactive":
    case "button":
      return { type: "interactive_reply" };
    default:
      return { type: "unsupported" };
  }
}

function buildInstance(metadata: WhatsAppOfficialMetadata) {
  return {
    externalId: metadata.phone_number_id,
    displayPhone: metadata.display_phone_number,
  } as const;
}

function buildSender(
  message: WhatsAppOfficialInboundMessage,
  contactName?: string,
) {
  return {
    phone: message.from,
    displayName: contactName,
    fromMe: false, // a Meta NÃO entrega mensagens fromMe via webhook inbound.
  } as const;
}

function normalizeMessage(
  message: WhatsAppOfficialInboundMessage,
  metadata: WhatsAppOfficialMetadata,
  contactName?: string,
): CanonicalInboundMessage {
  const sentAt = new Date(Number(message.timestamp) * 1000);
  const base = {
    externalMessageId: message.id,
    sentAt: isNaN(sentAt.getTime()) ? new Date() : sentAt,
    replyToExternalMessageId: message.context?.id,
    sender: buildSender(message, contactName),
    instance: buildInstance(metadata),
  } as const;

  const mapped = metaTypeToCanonicalKind(message.type);

  switch (message.type) {
    case "text":
      return { ...base, type: "text", body: message.text.body };

    case "image":
      return {
        ...base,
        type: "media",
        kind: "image",
        mediaId: message.image.id,
        mediaUrl: message.image.url,
        mimetype: message.image.mime_type,
        sha256: message.image.sha256,
        caption: message.image.caption,
      };
    case "video":
      return {
        ...base,
        type: "media",
        kind: "video",
        mediaId: message.video.id,
        mediaUrl: message.video.url,
        mimetype: message.video.mime_type,
        sha256: message.video.sha256,
        caption: message.video.caption,
      };
    case "audio":
      return {
        ...base,
        type: "media",
        kind: "audio",
        mediaId: message.audio.id,
        mediaUrl: message.audio.url,
        mimetype: message.audio.mime_type,
        sha256: message.audio.sha256,
        isVoice: message.audio.voice,
      };
    case "document":
      return {
        ...base,
        type: "media",
        kind: "document",
        mediaId: message.document.id,
        mediaUrl: message.document.url,
        mimetype: message.document.mime_type,
        sha256: message.document.sha256,
        fileName: message.document.filename,
        caption: message.document.caption,
      };
    case "sticker":
      return {
        ...base,
        type: "media",
        kind: "sticker",
        mediaId: message.sticker.id,
        mediaUrl: message.sticker.url,
        mimetype: message.sticker.mime_type,
        sha256: message.sticker.sha256,
      };

    case "location":
      return {
        ...base,
        type: "location",
        latitude: message.location.latitude,
        longitude: message.location.longitude,
        name: message.location.name,
        address: message.location.address,
      };

    case "contacts": {
      // A Meta entrega `contacts[]`. Pegamos o primeiro — caso UI precise
      // múltiplos no futuro, expandir aqui.
      const first = message.contacts[0] as Record<string, unknown> | undefined;
      const name = (first?.["name"] as Record<string, unknown> | undefined)?.[
        "formatted_name"
      ];
      const phones = first?.["phones"] as
        | Array<Record<string, unknown>>
        | undefined;
      const phone = phones?.[0]?.["phone"];
      return {
        ...base,
        type: "contact",
        contactName: typeof name === "string" ? name : "",
        contactPhone: typeof phone === "string" ? phone : "",
      };
    }

    case "reaction":
      return {
        ...base,
        type: "reaction",
        targetExternalMessageId: message.reaction.message_id,
        emoji: message.reaction.emoji,
      };

    case "button":
      return {
        ...base,
        type: "interactive_reply",
        replyId: message.button.payload,
        replyText: message.button.text,
      };

    case "interactive": {
      // O payload `interactive` da Meta tem variantes (button_reply,
      // list_reply, etc.). Extraímos o que conseguirmos sem amarrar
      // demais — Phase 3 pode refinar.
      const i = message.interactive as Record<string, unknown>;
      const buttonReply = i["button_reply"] as
        | Record<string, unknown>
        | undefined;
      const listReply = i["list_reply"] as Record<string, unknown> | undefined;
      const reply = buttonReply ?? listReply;
      return {
        ...base,
        type: "interactive_reply",
        replyId: reply?.["id"] as string | undefined,
        replyText: reply?.["title"] as string | undefined,
      };
    }

    default:
      return {
        ...base,
        type: mapped.type === "unsupported" ? "unsupported" : "unsupported",
        providerType: message.type,
      };
  }
}

function normalizeStatus(
  status: WhatsAppOfficialStatus,
): CanonicalInboundStatusUpdate {
  const at = new Date(Number(status.timestamp) * 1000);
  return {
    externalMessageId: status.id,
    status: status.status,
    at: isNaN(at.getTime()) ? new Date() : at,
    recipientPhone: status.recipient_id,
    errorReason: status.errors?.[0]
      ? JSON.stringify(status.errors[0])
      : undefined,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Implementação da PORT
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extrai e valida o `wamid` da resposta da Meta. Se a Meta devolveu 200
 * mas `messages[]` está vazio ou sem `id` válido — o que seria razoável
 * apenas em soft-fail/rate-limit raros — falhamos com erro estruturado
 * (`ProviderSendInvalidResponseError`) em vez de gravar string vazia em
 * `Message.messageId` (que tem `@unique`).
 *
 * Sem isso:
 *  - O próximo send que caísse no mesmo bug bateria em
 *    `PrismaClientKnownRequestError` por colisão de chave única.
 *  - Deletes/edits keyed em `messageId === ""` poderiam atingir a
 *    mensagem errada.
 *
 * Usar `ProviderSendInvalidResponseError` (subclasse de
 * `OutboundProviderError`) garante que o handler oRPC mapeie pra
 * `errors.BAD_REQUEST({ data: { code: "PROVIDER_SEND_INVALID_RESPONSE" } })`
 * — frontend reconhece como falha transitória e pode oferecer retry.
 */
function extractWamid(
  response: { messages: Array<{ id: string }> },
  operation: string,
): string {
  const wamid = response.messages[0]?.id;
  if (!wamid) {
    throw new ProviderSendInvalidResponseError(
      "meta-cloud",
      operation,
      `Resposta: ${JSON.stringify(response).slice(0, 200)}`,
    );
  }
  return wamid;
}

export class OfficialProvider implements WhatsAppChatProvider {
  readonly id = "meta-cloud" as const;

  constructor(private readonly config: MetaCloudProviderConfig) {}

  async sendText(input: SendCanonicalText): Promise<SendResult> {
    const response = await sendOfficialText(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        body: input.body,
        previewUrl: input.previewUrl,
        replyToWamid: input.replyToExternalMessageId,
      },
    );
    return {
      externalMessageId: extractWamid(response, "sendText"),
      raw: response,
    };
  }

  async sendMedia(input: SendCanonicalMedia): Promise<SendResult> {
    const mediaIdOrLink = input.mediaId ?? input.mediaUrl;
    if (!mediaIdOrLink) {
      throw new Error(
        "OfficialProvider.sendMedia: precisa de `mediaId` ou `mediaUrl`.",
      );
    }
    // sendOfficialMedia já decide internamente: URL → { link }, senão → { id }.
    const response = await sendOfficialMedia(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        kind: toMetaMediaKind(input.mediaKind),
        mediaIdOrLink,
        caption: input.caption,
        filename: input.fileName,
        replyToWamid: input.replyToExternalMessageId,
      },
    );
    return {
      externalMessageId: extractWamid(response, "sendMedia"),
      raw: response,
    };
  }

  async sendLocation(input: SendCanonicalLocation): Promise<SendResult> {
    const response = await sendOfficialLocation(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        address: input.address,
        replyToWamid: input.replyToExternalMessageId,
      },
    );
    return {
      externalMessageId: extractWamid(response, "sendLocation"),
      raw: response,
    };
  }

  async sendContact(input: SendCanonicalContact): Promise<SendResult> {
    const response = await sendOfficialContact(
      this.config.accessToken,
      this.config.phoneNumberId,
      {
        to: normalizePhoneToMetaE164(input.to),
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        organization: input.organization,
        email: input.email,
        replyToWamid: input.replyToExternalMessageId,
      },
    );
    return {
      externalMessageId: extractWamid(response, "sendContact"),
      raw: response,
    };
  }

  verifyWebhook(rawBody: string, headers: ProviderWebhookHeaders): boolean {
    if (!this.config.appSecret) {
      // Sem App Secret configurado — em produção isso é erro de config;
      // aqui devolvemos `false` (fail-closed) pra Phase 5 rejeitar.
      return false;
    }
    const signature =
      headers["x-hub-signature-256"] ?? headers["X-Hub-Signature-256"];
    return isMetaSignatureValid(
      rawBody,
      signature ?? null,
      this.config.appSecret,
    );
  }

  normalizeInbound(rawPayload: unknown): NormalizedInbound | null {
    const parsed = parseWhatsAppOfficialWebhook(rawPayload);
    if (!parsed) return null;

    const messages: CanonicalInboundMessage[] = [];
    const statusUpdates: CanonicalInboundStatusUpdate[] = [];

    for (const entry of parsed.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const metadata = value.metadata;
        // Lookup nome do contato por wa_id pra anexar como displayName.
        const nameByWaId = new Map<string, string | undefined>();
        for (const contact of value.contacts ?? []) {
          nameByWaId.set(contact.wa_id, contact.profile?.name);
        }
        for (const message of value.messages ?? []) {
          messages.push(
            normalizeMessage(message, metadata, nameByWaId.get(message.from)),
          );
        }
        for (const status of value.statuses ?? []) {
          statusUpdates.push(normalizeStatus(status));
        }
      }
    }

    return { messages, statusUpdates };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Builder + auto-registro
// ────────────────────────────────────────────────────────────────────────────

const metaCloudBuilder: ProviderBuilder = (config: ProviderConfig) => {
  return new OfficialProvider(metaCloudConfigSchema.parse(config));
};

registerProvider("meta-cloud", metaCloudBuilder);
