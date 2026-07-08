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
  /** Só para `kind: "audio"`: marca como nota de voz (PTT). Exige OGG/Opus. */
  voice?: boolean;
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

// ─── Templates HSM (Fase 9) ──────────────────────────────────────────────

/** Status do template no fluxo de aprovação da Meta. */
export type MessageTemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "PENDING_DELETION"
  | "DELETED"
  | "LIMIT_EXCEEDED"
  | "ARCHIVED";

export type MessageTemplateCategory =
  | "MARKETING"
  | "UTILITY"
  | "AUTHENTICATION"
  | "FREE_SERVICE";

/**
 * Um componente do template como a Meta devolve na listagem. `HEADER`/`BODY`
 * têm `text`; `HEADER` de mídia carrega `format` != TEXT; `BUTTONS` traz
 * `buttons[]`. `example.body_text` lista os valores de exemplo das variáveis
 * `{{n}}` (uma linha por amostra), usado pra inferir a contagem de variáveis.
 */
export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS" | "CAROUSEL" | "LIMITED_TIME_OFFER";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: Array<{ type: string; text?: string }>;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
}

export interface MessageTemplate {
  id: string;
  name: string;
  /** Código do idioma, ex. `pt_BR`, `en_US`. */
  language: string;
  status: MessageTemplateStatus;
  category: MessageTemplateCategory;
  sub_category?: string;
  components: TemplateComponent[];
  quality_score?: { score?: string; reason?: string };
}

export interface MessageTemplatesResponse {
  data: MessageTemplate[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
}

/**
 * Input canônico de envio de template. Nesta fase cobrimos variáveis de
 * **body** e header de **texto** — uma string por placeholder `{{n}}`, na
 * ordem. Header de mídia / botões dinâmicos ficam pra Fase 10.
 */
export interface SendTemplateInput {
  to: E164DigitsOnly;
  templateName: string;
  /** Código do idioma exato do template aprovado (ex.: `pt_BR`). */
  languageCode: string;
  /** Valores das variáveis do corpo (`{{1}}…{{n}}`), na ordem. */
  bodyParameters?: string[];
  /** Valores das variáveis do header de texto, na ordem. */
  headerParameters?: string[];
  replyToWamid?: Wamid;
}

// ─── Marketing Messages API (Campanhas — disparo em massa) ───────────────

/**
 * Política de fallback do `/marketing_messages`.
 *  - `CLOUD_API_FALLBACK` (default): cai pra Cloud API se o onboarding MM
 *    não estiver completo.
 *  - `STRICT`: sem fallback (erro se MM não disponível).
 */
export type MarketingMessageProductPolicy =
  | "CLOUD_API_FALLBACK"
  | "STRICT";

/**
 * Input canônico de envio via **Marketing Messages API**
 * (`POST /{phone_number_id}/marketing_messages`). Só aceita templates de
 * **marketing aprovados** — mesma forma de variáveis do `SendTemplateInput`.
 *
 * Usado pelo app de Campanhas (disparo em massa). Nesta fase é apenas
 * contrato — o wiring real acontece na Fase 3.
 */
export interface SendMarketingMessageInput {
  to: E164DigitsOnly;
  templateName: string;
  /** Código do idioma exato do template de marketing aprovado (ex.: `pt_BR`). */
  languageCode: string;
  /** Valores das variáveis do corpo (`{{1}}…{{n}}`), na ordem. */
  bodyParameters?: string[];
  /** Valores das variáveis do header de texto, na ordem. */
  headerParameters?: string[];
  /** Default `CLOUD_API_FALLBACK` quando omitido. */
  productPolicy?: MarketingMessageProductPolicy;
  /**
   * Compartilha atividade da mensagem (ex.: read) pra otimização de entrega.
   * Quando omitido, usa a config default da WABA.
   */
  messageActivitySharing?: boolean;
}

// ─── Criação de templates (Campanhas — Fase 2) ───────────────────────────

/** Formato do header no momento da CRIAÇÃO do template. */
export type TemplateHeaderFormat =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"
  | "LOCATION";

/**
 * Um componente do template no payload de **criação**
 * (`POST /{waba_id}/message_templates`). Difere de `TemplateComponent`
 * (leitura) porque os `example` seguem o shape exato exigido pela Meta:
 *  - HEADER texto → `example.header_text: string[]`
 *  - HEADER mídia → `example.header_handle: string[]` (handle do resumable upload)
 *  - BODY → `example.body_text: string[][]` (uma linha de exemplos por conjunto)
 *  - Botão URL dinâmico → `example: string[]`; COPY_CODE → `example: string`
 */
export interface CreateTemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
  text?: string;
  url?: string;
  phone_number?: string;
  example?: string[] | string;
}

export interface CreateTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: TemplateHeaderFormat;
  text?: string;
  buttons?: CreateTemplateButton[];
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
}

/** Payload canônico de criação de um message template. */
export interface CreateMessageTemplateRequest {
  name: string;
  /** Código do idioma (ex.: `pt_BR`, `en_US`). */
  language: string;
  category: MessageTemplateCategory;
  components: CreateTemplateComponent[];
}

/** Resposta de `POST /{waba_id}/message_templates`. */
export interface CreateMessageTemplateResponse {
  id: string;
  status: MessageTemplateStatus;
  category: MessageTemplateCategory;
}

/**
 * Resposta do 1º passo do Resumable Upload (`POST /{app_id}/uploads`).
 * O `id` é a sessão de upload (`upload:...`) usada no 2º passo.
 */
export interface ResumableUploadSessionResponse {
  id: string;
}

/** Resposta do 2º passo do Resumable Upload — `h` é o header handle. */
export interface ResumableUploadFileResponse {
  h: string;
}

// ─── Analytics (Fase 10) ─────────────────────────────────────────────────

/** Granularidade aceita por `GET /{waba_id}?fields=analytics...`. */
export type MessageAnalyticsGranularity = "HALF_HOUR" | "DAY" | "MONTH";

export interface MessageAnalyticsDataPoint {
  start: number;
  end: number;
  sent: number;
  delivered: number;
}

export interface MessageAnalyticsResponse {
  id: string;
  analytics?: {
    data_points: MessageAnalyticsDataPoint[];
    granularity: MessageAnalyticsGranularity;
    phone_numbers?: string[];
  };
}

/** Granularidade aceita por `GET /{waba_id}?fields=conversation_analytics...`. */
export type ConversationAnalyticsGranularity =
  | "HALF_HOUR"
  | "DAILY"
  | "MONTHLY";

export type ConversationCategory =
  | "AUTHENTICATION"
  | "AUTHENTICATION_INTERNATIONAL"
  | "MARKETING"
  | "UTILITY"
  | "SERVICE";

export type ConversationType = "FREE_TIER" | "REGULAR" | "FREE_ENTRY_POINT";

export type ConversationDirection =
  | "BUSINESS_INITIATED"
  | "USER_INITIATED"
  | "UNKNOWN";

export interface ConversationAnalyticsDataPoint {
  start: number;
  end: number;
  conversation: number;
  cost?: number;
  phone_number?: string;
  country?: string;
  conversation_type?: ConversationType;
  conversation_direction?: ConversationDirection;
  conversation_category?: ConversationCategory;
}

export interface ConversationAnalyticsResponse {
  id: string;
  conversation_analytics?: {
    data: Array<{ data_points: ConversationAnalyticsDataPoint[] }>;
  };
}
