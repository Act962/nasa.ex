/**
 * Tipos brutos da WhatsApp Business Cloud API (Meta).
 *
 * Apenas response shapes + erro. Os tipos do webhook inbound vivem em
 * `webhook-schema.ts` (inferidos via `z.infer`) para evitar duplicação.
 *
 * Este módulo é HTTP CRU — não normaliza para o canônico do domínio.
 * A normalização vive na PORT em `src/features/tracking-chat/lib/providers/`
 * (Fase 2 do roadmap).
 */

/** Telefone em E.164 SEM `+` (ex.: `5586988923098`). */
export type E164DigitsOnly = string;

/** ID de uma mídia já carregada (`POST /{phoneNumberId}/media` → { id }). */
export type MediaId = string;

/** ID externo de mensagem retornado pela Meta (`wamid.HBgM...`). */
export type Wamid = string;

/** Erro padrão da Graph API. */
export interface MetaApiError {
  error: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
    error_data?: { messaging_product?: string; details?: string };
  };
}

export interface SendMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: Wamid; message_status?: string }>;
}

export interface MediaUploadResponse {
  id: MediaId;
}

export interface MediaUrlResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: MediaId;
  messaging_product: "whatsapp";
}

export type OutboundMediaKind =
  | "image"
  | "audio"
  | "document"
  | "sticker"
  | "video";

export interface SendTextInput {
  to: E164DigitsOnly;
  body: string;
  previewUrl?: boolean;
  replyToWamid?: Wamid;
}

export interface SendMediaInput {
  to: E164DigitsOnly;
  kind: OutboundMediaKind;
  /** Aceita `MediaId` (preferencial) OU URL pública/presigned. */
  mediaIdOrLink: MediaId | string;
  caption?: string;
  filename?: string;
  replyToWamid?: Wamid;
}

export interface SendLocationInput {
  to: E164DigitsOnly;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  replyToWamid?: Wamid;
}

export interface SendContactInput {
  to: E164DigitsOnly;
  fullName: string;
  phoneNumber: string;
  organization?: string;
  email?: string;
  replyToWamid?: Wamid;
}

export interface UploadMediaInput {
  file: Blob | Buffer;
  mimetype: string;
  filename?: string;
}
