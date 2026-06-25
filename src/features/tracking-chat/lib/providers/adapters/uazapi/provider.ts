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
import { ProviderSendInvalidResponseError } from "../../outbound-errors";
import type {
  CanonicalInboundContact,
  CanonicalInboundInteractiveReply,
  CanonicalInboundLocation,
  CanonicalInboundMedia,
  CanonicalInboundMessage,
  CanonicalInboundRevoke,
  CanonicalInboundText,
  CanonicalInboundUnsupported,
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

type UazapiMessageKind =
  | { type: "text" }
  | { type: "media"; mediaKind: CanonicalMediaKind }
  | { type: "location" }
  | { type: "contact" }
  | { type: "interactive_reply" }
  | { type: "protocol" }
  | { type: "unsupported" };

function mapUazapiMessageType(messageType: string | undefined): UazapiMessageKind {
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
    case "LocationMessage":
    case "Location":
      return { type: "location" };
    case "ContactMessage":
    case "ContactsArrayMessage":
      return { type: "contact" };
    case "TemplateButtonReplyMessage":
    case "ButtonsResponseMessage":
    case "ListResponseMessage":
    case "InteractiveResponseMessage":
      return { type: "interactive_reply" };
    case "ProtocolMessage":
      return { type: "protocol" };
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

/** Safe-ish acessor pra `obj[key]` quando `obj` é unknown. */
function pick(source: unknown, key: string): unknown {
  if (source && typeof source === "object") {
    return (source as Record<string, unknown>)[key];
  }
  return undefined;
}

function pickString(source: unknown, key: string): string | undefined {
  const value = pick(source, key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pickNumber(source: unknown, key: string): number | undefined {
  const value = pick(source, key);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pickBoolean(source: unknown, key: string): boolean | undefined {
  const value = pick(source, key);
  return typeof value === "boolean" ? value : undefined;
}

/**
 * Extrai `{ name, phone }` de um vcard de contato. Mesma lógica do route.ts
 * — quando `phone` vem com `waid=` no parâmetro do TEL, preferimos esse
 * (é o WhatsApp ID limpo). Senão cai pro número formatado.
 */
function extractFromVcard(
  vcard: string | undefined | null,
): { name: string | null; phone: string | null } | null {
  if (!vcard || typeof vcard !== "string") return null;
  const fnMatch = vcard.match(
    /(?:^|\r?\n)(?:item\d+\.)?FN[^:]*:([^\r\n]+)/i,
  );
  const telLine = vcard.match(
    /(?:^|\r?\n)(?:item\d+\.)?TEL[^:]*:([^\r\n]+)/i,
  );
  let phone: string | null = null;
  if (telLine) {
    const waidMatch = telLine[0].match(/waid=([0-9]+)/i);
    phone = waidMatch ? waidMatch[1] : telLine[1].replace(/[^0-9+]/g, "");
  }
  return {
    name: fnMatch?.[1]?.trim() || null,
    phone,
  };
}

/** Detecta se um ProtocolMessage é revoke ("apagada para todos"). */
function isProtocolRevoke(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const c = content as Record<string, unknown>;
  const ptype = String(c.type ?? "").toUpperCase();
  return (
    c.type === 0 ||
    ptype.includes("REVOKE") ||
    !!c.revokedMessageKey ||
    !!c.revokeMessageKey
  );
}

/** Extrai o `messageId` alvo de um ProtocolMessage revoke. */
function extractRevokeTargetId(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  const candidates: unknown[] = [
    pick(c.key, "id"),
    pick(c.revokedMessageKey, "id"),
    pick(c.revokeMessageKey, "id"),
    c.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Implementação da PORT
// ────────────────────────────────────────────────────────────────────────────

/**
 * Garante que o `id` da resposta Uazapi é uma string não-vazia. Se
 * Uazapi devolveu 200 sem `id` (timeout interno raro), falhamos com
 * `ProviderSendInvalidResponseError` em vez de gravar string vazia em
 * `Message.messageId` (mesma classe de bug do `OfficialProvider` —
 * fix paralelo). Ver outbound-errors.ts.
 */
function extractUazapiId(
  response: { id?: string | null },
  operation: string,
): string {
  const id = response?.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new ProviderSendInvalidResponseError(
      "uazapi",
      operation,
      `Resposta: ${JSON.stringify(response).slice(0, 200)}`,
    );
  }
  return id;
}

export class UazapiProvider implements WhatsAppChatProvider {
  readonly id = "uazapi" as const;

  constructor(private readonly config: UazapiProviderConfig) {}

  async sendText(input: SendCanonicalText): Promise<SendResult> {
    const markRead = input.markPreviousAsRead ?? true;
    const response = await sendText(
      this.config.token,
      {
        number: input.to,
        text: input.body,
        linkPreview: input.previewUrl ?? false,
        replyid: input.replyToExternalMessageId,
        readmessages: markRead,
        readchat: markRead,
      },
      this.config.baseUrl,
    );
    return {
      externalMessageId: extractUazapiId(response, "sendText"),
      raw: response,
    };
  }

  async sendMedia(input: SendCanonicalMedia): Promise<SendResult> {
    if (!input.mediaUrl) {
      // Uazapi precisa de `file` (URL/base64). `mediaId` é conceito Meta-only.
      throw new Error(
        "UazapiProvider.sendMedia: `mediaUrl` é obrigatório (Uazapi não suporta `mediaId`).",
      );
    }
    const markRead = input.markPreviousAsRead ?? true;
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
        readmessages: markRead,
        readchat: markRead,
      },
      this.config.baseUrl,
    );
    return {
      externalMessageId: extractUazapiId(response, "sendMedia"),
      raw: response,
    };
  }

  async sendLocation(input: SendCanonicalLocation): Promise<SendResult> {
    const markRead = input.markPreviousAsRead ?? true;
    const response = await sendLocation(
      this.config.token,
      {
        number: input.to,
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        address: input.address,
        replyid: input.replyToExternalMessageId,
        readmessages: markRead,
        readchat: markRead,
      },
      this.config.baseUrl,
    );
    return {
      externalMessageId: extractUazapiId(response, "sendLocation"),
      raw: response,
    };
  }

  async sendContact(input: SendCanonicalContact): Promise<SendResult> {
    const markRead = input.markPreviousAsRead ?? true;
    const response = await sendContact(
      this.config.token,
      {
        number: input.to,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        organization: input.organization,
        email: input.email,
        replyid: input.replyToExternalMessageId,
        readmessages: markRead,
        readchat: markRead,
      },
      this.config.baseUrl,
    );
    return {
      externalMessageId: extractUazapiId(response, "sendContact"),
      raw: response,
    };
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

    // O schema é permissivo (.passthrough). Os campos críticos (messageid,
    // messageTimestamp, text, quoted, edited, owner) ficam fora dos campos
    // tipados. Acessamos via raw com helpers seguros.
    const raw = rawPayload as Record<string, unknown>;
    const message = raw.message as Record<string, unknown>;
    const event = parsed.data;
    const content = message.content;

    const messageType =
      typeof message.messageType === "string" ? message.messageType : undefined;
    const kind = mapUazapiMessageType(messageType);
    const chatid = String(message.chatid ?? "");
    const phone = extractPhoneFromChatId(chatid);
    const fromMe = Boolean(message.fromMe);

    const messageId =
      pickString(message, "messageid") ?? pickString(content, "messageid") ?? "";
    const sentAtMs = pickNumber(message, "messageTimestamp");
    const sentAt = sentAtMs ? new Date(sentAtMs) : new Date();

    const replyToExternalMessageId = pickString(message, "quoted");
    const editedExternalMessageId = pickString(message, "edited");

    const instance = {
      externalId: event.token ?? this.config.token,
      instanceToken: event.token ?? this.config.token,
      ownerExternalId: pickString(raw, "owner"),
    } as const;

    // displayName fallback: senderName → chat.name (paridade com fallback
    // chain do route.ts pré-Fase 3).
    const sender = {
      phone,
      displayName:
        pickString(message, "senderName") ?? pickString(raw.chat, "name"),
      fromMe,
    } as const;

    const base = {
      externalMessageId: messageId,
      sentAt,
      ...(replyToExternalMessageId ? { replyToExternalMessageId } : {}),
      ...(editedExternalMessageId ? { editedExternalMessageId } : {}),
      sender,
      instance,
    } as const;

    // ── Revoke (ProtocolMessage) ────────────────────────────────────────
    if (kind.type === "protocol") {
      if (!isProtocolRevoke(content)) {
        // ProtocolMessage não-revoke (ex.: confirmação de leitura) — ignora.
        return { messages: [] };
      }
      const targetExternalMessageId = extractRevokeTargetId(content);
      if (!targetExternalMessageId) return { messages: [] };
      const revoke: CanonicalInboundRevoke = {
        ...base,
        type: "revoke",
        targetExternalMessageId,
      };
      return { messages: [revoke] };
    }

    // ── Body extraction (compartilhado entre text e interactive) ────────
    const textTop = pickString(message, "text");
    const contentText = pickString(content, "text");
    const contentString = typeof content === "string" ? content : undefined;
    const contentCaption = pickString(content, "caption");
    const body =
      textTop ?? contentText ?? contentString ?? contentCaption ?? "";

    if (kind.type === "text") {
      const text: CanonicalInboundText = { ...base, type: "text", body };
      return { messages: [text] };
    }

    if (kind.type === "interactive_reply") {
      // Mantém paridade com route.ts:
      //  finalBody = body || selectedDisplayText || selectedButtonId
      //                   || title || vote || "";
      const replyText =
        body ||
        pickString(content, "selectedDisplayText") ||
        pickString(content, "selectedButtonId") ||
        pickString(content, "title") ||
        pickString(message, "vote") ||
        "";
      // Resposta de lista (ListResponseMessage) traz o id da linha aninhado
      // em `content.singleSelectReply.selectedRowID` (note o `ID` maiúsculo no
      // payload real da uazapi) e/ou plano em `message.buttonOrListid`. Resposta
      // de botão usa `content.selectedButtonId`. Cobrir os dois shapes mantém o
      // `buttonTagMap[replyId]` casando para botões E listas.
      const singleSelectReply = pick(content, "singleSelectReply");
      const replyId =
        pickString(content, "selectedButtonId") ??
        pickString(content, "selectedRowId") ??
        pickString(singleSelectReply, "selectedRowID") ??
        pickString(singleSelectReply, "selectedRowId") ??
        pickString(message, "buttonOrListid") ??
        pickString(content, "id");
      const interactive: CanonicalInboundInteractiveReply = {
        ...base,
        type: "interactive_reply",
        ...(replyId ? { replyId } : {}),
        replyText,
      };
      return { messages: [interactive] };
    }

    if (kind.type === "media") {
      const media: CanonicalInboundMedia = {
        ...base,
        type: "media",
        kind: kind.mediaKind,
        mediaUrl: pickString(content, "fileURL"),
        mimetype: pickString(content, "mimetype"),
        fileName: pickString(content, "fileName"),
        caption: contentCaption,
      };
      return { messages: [media] };
    }

    if (kind.type === "location") {
      const latitude =
        pickNumber(content, "degreesLatitude") ??
        pickNumber(content, "latitude") ??
        pickNumber(content, "lat");
      const longitude =
        pickNumber(content, "degreesLongitude") ??
        pickNumber(content, "longitude") ??
        pickNumber(content, "lng");
      if (latitude === undefined || longitude === undefined) {
        // Sem coordenadas — não há localização válida pra persistir.
        const unsupported: CanonicalInboundUnsupported = {
          ...base,
          type: "unsupported",
          providerType: messageType,
        };
        return { messages: [unsupported] };
      }
      const location: CanonicalInboundLocation = {
        ...base,
        type: "location",
        latitude,
        longitude,
        name: pickString(content, "name"),
        address: pickString(content, "address"),
      };
      return { messages: [location] };
    }

    if (kind.type === "contact") {
      const contacts = pick(content, "contacts");
      const firstContact =
        Array.isArray(contacts) && contacts.length > 0
          ? contacts[0]
          : content;
      const vcardString = pickString(firstContact, "vcard");
      const parsedVcard = extractFromVcard(vcardString ?? null);
      const contactName =
        pickString(firstContact, "displayName") ??
        pickString(firstContact, "fullName") ??
        parsedVcard?.name ??
        "";
      const contactPhone =
        parsedVcard?.phone ?? pickString(firstContact, "phoneNumber") ?? "";
      if (!contactName && !contactPhone) {
        return { messages: [] };
      }
      const contact: CanonicalInboundContact = {
        ...base,
        type: "contact",
        contactName,
        contactPhone,
      };
      return { messages: [contact] };
    }

    const unsupported: CanonicalInboundUnsupported = {
      ...base,
      type: "unsupported",
      providerType: messageType,
    };
    return { messages: [unsupported] };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Builder + auto-registro
// ────────────────────────────────────────────────────────────────────────────

const uazapiBuilder: ProviderBuilder = (config: ProviderConfig) => {
  return new UazapiProvider(uazapiConfigSchema.parse(config));
};

registerProvider("uazapi", uazapiBuilder);
