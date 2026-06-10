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

// ─── Embedded Signup (Fase 7) ────────────────────────────────────────────

/** Resposta do endpoint OAuth de troca de `code` por Business Token. */
export interface OAuthExchangeResponse {
  access_token: string;
  token_type: string;
  /** Em segundos. Business Integration tokens são long-lived (omitido pelo Meta normalmente). */
  expires_in?: number;
}

/** Resposta de `POST /{waba_id}/subscribed_apps`. */
export interface SubscribeAppResponse {
  success: boolean;
}

/** Resposta de `POST /{phone_number_id}/register`. */
export interface RegisterPhoneResponse {
  success: boolean;
}

/** Status de verificação do código exigido pelo Meta no register-phone. */
export type CodeVerificationStatus =
  | "NOT_VERIFIED"
  | "VERIFIED"
  | "EXPIRED";

/** Qualidade do número (Meta atualiza com base no engajamento). */
export type QualityRating = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export interface PhoneNumberMetadata {
  id: string;
  display_phone_number: string;
  verified_name: string;
  code_verification_status?: CodeVerificationStatus;
  quality_rating?: QualityRating;
  /** Faixa de janelas/dia (TIER_50, TIER_250, TIER_1K, TIER_10K, TIER_100K, TIER_UNLIMITED). */
  messaging_limit_tier?: string;
  /** "CLOUD_API" | "ON_PREMISE" — esperado sempre CLOUD_API para Embedded Signup. */
  platform_type?: string;
}

export interface PhoneNumbersListResponse {
  data: PhoneNumberMetadata[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
}

export interface WabaInfo {
  id: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
  message_template_namespace?: string;
  account_review_status?: string;
}
