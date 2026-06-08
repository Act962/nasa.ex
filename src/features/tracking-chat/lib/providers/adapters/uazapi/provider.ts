/**
 * UazapiProvider — adapter da PORT `WhatsAppChatProvider` em cima do
 * cliente HTTP cru da Uazapi (`src/http/uazapi/*`).
 *
 * Esta classe NÃO substitui nada hoje em dia — o `router/message/*` e o
 * webhook em produção continuam falando Uazapi direto. A Fase 6 é que vai
 * resolver o provider via factory por-tracking; nesta Fase 2 a classe só
 * precisa **compilar** e estar pronta pra ser plugada.
 *
 * Mapeamento canônico ↔ Uazapi:
 *  - `to` canônico (E.164 sem `+`) → `number` Uazapi.
 *  - `mediaUrl` → `file` (Uazapi aceita URL ou base64).
 *  - `mediaKind` canônico mapeia 1:1 com `MediaType` da Uazapi exceto
 *    "audio" → "myaudio" (a Uazapi distingue PTT/audio; usamos `myaudio`
 *    pra arquivos enviados pelo atendente, igual ao chat já faz hoje).
 *  - Webhook inbound: `messageType` da Uazapi → `type` canônico via tabela
 *    interna `mapUazapiMessageType()`.
 */
import "server-only";
import { z } from "zod";

import { sendText } from "@/http/uazapi/send-text";
import { sendMedia } from "@/http/uazapi/send-media";
import { sendLocation } from "@/http/uazapi/send-location";
import { sendContact } from "@/http/uazapi/send-contact";
import type { MediaType } from "@/http/uazapi/types";
import { messagesEventSchema } from "@/http/uazapi/webhook-schema";

import { registerProvider } from "../../factory";
import type {
  CanonicalInboundMessage,
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
// Config concreta da Uazapi
// ────────────────────────────────────────────────────────────────────────────

const uazapiConfigSchema = z.object({
  token: z.string().min(1, "uazapi token obrigatório"),
  baseUrl: z.string().url().optional(),
});

export type UazapiProviderConfig = z.infer<typeof uazapiConfigSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Mapeamento canônico → Uazapi
// ────────────────────────────────────────────────────────────────────────────

function toUazapiMediaType(kind: CanonicalMediaKind): MediaType {
  switch (kind) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      // Áudio enviado pelo atendente → arquivo de áudio (não PTT).
      // PTT real entra como `ptt` quando a UI quiser; canônico ainda não
      // distingue voz vs arquivo de saída.
      return "myaudio";
    case "document":
      return "document";
    case "sticker":
      return "sticker";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Mapeamento Uazapi → canônico (inbound)
// ────────────────────────────────────────────────────────────────────────────

function mapUazapiMessageType(messageType: string | undefined): {
  type: CanonicalInboundMessage["type"];
  mediaKind?: CanonicalMediaKind;
} {
  switch (messageType) {
    case "Conversation":
    case "ExtendedTextMessage":
      return { type: "text" };
    case "ImageMessage":
      return { type: "media", mediaKind: "image" };
    case "VideoMessage":
      return { type: "media", mediaKind: "video" };
    case "AudioMessage":
      return { type: "media", mediaKind: "audio" };
    case "DocumentMessage":
      return { type: "media", mediaKind: "document" };
    case "StickerMessage":
      return { type: "media", mediaKind: "sticker" };
    default:
      return { type: "unsupported" };
  }
}

/**
 * Extrai o número (E.164 sem `+`) de um `chatid` Uazapi
 * (ex.: `5586988923098@s.whatsapp.net` → `5586988923098`).
 */
function extractPhoneFromChatId(chatid: string): string {
  const at = chatid.indexOf("@");
  return at >= 0 ? chatid.slice(0, at) : chatid;
}

// ────────────────────────────────────────────────────────────────────────────
// Implementação da PORT
// ────────────────────────────────────────────────────────────────────────────

export class UazapiProvider implements WhatsAppChatProvider {
  readonly id = "uazapi" as const;

  constructor(private readonly config: UazapiProviderConfig) {}

  async sendText(input: SendCanonicalText): Promise<SendResult> {
    const response = await sendText(
      this.config.token,
      {
        number: input.to,
        text: input.body,
        linkPreview: input.previewUrl ?? false,
        replyid: input.replyToExternalMessageId,
      },
      this.config.baseUrl,
    );
    return { externalMessageId: response.id, raw: response };
  }

  async sendMedia(input: SendCanonicalMedia): Promise<SendResult> {
    if (!input.mediaUrl) {
      // Uazapi precisa de `file` (URL/base64). `mediaId` é conceito Meta-only.
      throw new Error(
        "UazapiProvider.sendMedia: `mediaUrl` é obrigatório (Uazapi não suporta `mediaId`).",
      );
    }
    const response = await sendMedia(
      this.config.token,
      {
        number: input.to,
        type: toUazapiMediaType(input.mediaKind),
        file: input.mediaUrl,
        text: input.caption,
        docName: input.fileName,
        mimetype: input.mimetype,
        replyid: input.replyToExternalMessageId,
      },
      this.config.baseUrl,
    );
    return { externalMessageId: response.id, raw: response };
  }

  async sendLocation(input: SendCanonicalLocation): Promise<SendResult> {
    const response = await sendLocation(
      this.config.token,
      {
        number: input.to,
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        address: input.address,
        replyid: input.replyToExternalMessageId,
      },
      this.config.baseUrl,
    );
    return { externalMessageId: response.id, raw: response };
  }

  async sendContact(input: SendCanonicalContact): Promise<SendResult> {
    const response = await sendContact(
      this.config.token,
      {
        number: input.to,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        organization: input.organization,
        email: input.email,
        replyid: input.replyToExternalMessageId,
      },
      this.config.baseUrl,
    );
    return { externalMessageId: response.id, raw: response };
  }

  verifyWebhook(_rawBody: string, _headers: ProviderWebhookHeaders): boolean {
    // Uazapi não assina o webhook hoje — autenticação é pelo `token` do
    // body. Phase 5 vai validar `token === expected` no handler; aqui a
    // PORT retorna `true` (não cabe ao adapter genérico esse check).
    return true;
  }

  normalizeInbound(rawPayload: unknown): NormalizedInbound | null {
    const parsed = messagesEventSchema.safeParse(rawPayload);
    if (!parsed.success) return null;

    const event = parsed.data;
    const message = event.message;

    const { type, mediaKind } = mapUazapiMessageType(message.messageType);
    const phone = extractPhoneFromChatId(message.chatid);

    const content = message.content as Record<string, unknown> | undefined;
    const messageId =
      typeof content?.["messageid"] === "string"
        ? (content["messageid"] as string)
        : typeof content?.["id"] === "string"
          ? (content["id"] as string)
          : String(content?.["messageid"] ?? "");
    const sentAtSec =
      typeof content?.["messageTimestamp"] === "number"
        ? (content["messageTimestamp"] as number)
        : Math.floor(Date.now() / 1000);

    const base = {
      externalMessageId: messageId,
      sentAt: new Date(sentAtSec * 1000),
      sender: {
        phone,
        displayName: message.senderName,
        fromMe: Boolean(message.fromMe),
      },
      instance: {
        externalId: event.token ?? this.config.token,
        instanceToken: event.token ?? this.config.token,
      },
    } as const;

    let canonical: CanonicalInboundMessage;
    if (type === "text") {
      const body =
        typeof content?.["text"] === "string"
          ? (content["text"] as string)
          : "";
      canonical = { ...base, type: "text", body };
    } else if (type === "media" && mediaKind) {
      const url =
        typeof content?.["fileURL"] === "string"
          ? (content["fileURL"] as string)
          : undefined;
      const mimetype =
        typeof content?.["mimetype"] === "string"
          ? (content["mimetype"] as string)
          : undefined;
      const fileName =
        typeof content?.["fileName"] === "string"
          ? (content["fileName"] as string)
          : undefined;
      const caption =
        typeof content?.["caption"] === "string"
          ? (content["caption"] as string)
          : undefined;
      canonical = {
        ...base,
        type: "media",
        kind: mediaKind,
        mediaUrl: url,
        mimetype,
        fileName,
        caption,
      };
    } else {
      canonical = { ...base, type: "unsupported", providerType: message.messageType };
    }

    return { messages: [canonical] };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Builder + auto-registro
// ────────────────────────────────────────────────────────────────────────────

const uazapiBuilder: ProviderBuilder = (config: ProviderConfig) => {
  return new UazapiProvider(uazapiConfigSchema.parse(config));
};

registerProvider("uazapi", uazapiBuilder);
