/**
 * PORT do chat de atendimento — `WhatsAppChatProvider`.
 *
 * Esta é a interface que a UI/oRPC enxerga. Cada provider (Uazapi, Meta
 * Cloud, futura terceira API) implementa esta porta sem que a UI saiba.
 * Padrão Ports & Adapters + Strategy/DIP.
 *
 *   UI / oRPC  ──►  WhatsAppChatProvider (esta porta)
 *                       ▲
 *                       │ implements
 *                       │
 *               ┌───────┴───────────┬───────────────────────┐
 *               │                   │                       │
 *        UazapiProvider     OfficialProvider          (futuro 3º)
 *        → src/http/uazapi  → src/http/whats-oficial
 *
 * Fase 2 — esta sessão. Tipos + interface + adapters. ZERO wiring com o
 * chat de produção; tudo isolado em `src/features/tracking-chat/lib/providers/`.
 * O webhook e o `router/message/*` continuam falando Uazapi direto até a
 * Fase 6.
 *
 * Ver também: `docs/whatsapp-oficial-overview.md`.
 */

// ════════════════════════════════════════════════════════════════════════════
// Canônico de inbound — o que Phase 3 recebe (provider-agnóstico)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Identificação de **onde** a mensagem chegou — qual `WhatsAppInstance` do
 * banco corresponde a este webhook. Cada provider preenche o que tem:
 *  - Uazapi → `instanceToken` (ou `instanceName`)
 *  - Meta   → `phoneNumberId` + `displayPhoneNumber`
 *
 * O lookup pra resolver o registro no Prisma fica na Fase 3 — a PORT só
 * carrega o id externo.
 */
export interface CanonicalInboundInstance {
  /** ID externo único do número que recebeu (depende do provider). */
  readonly externalId: string;
  /** Telefone display do número que recebeu (E.164 sem `+`, quando disponível). */
  readonly displayPhone?: string;
  /** Token/nome interno da instância (Uazapi). */
  readonly instanceToken?: string;
  readonly instanceName?: string;
  /**
   * ID do "dono" do número (operador) — preenchido pela Uazapi como
   * `json.owner` (ex.: `5586999999999@s.whatsapp.net`). Usado pela pipeline
   * canônica como `senderId` quando `fromMe=true` (atendente). Meta não
   * ecoa mensagens próprias via webhook, então não usa este campo.
   */
  readonly ownerExternalId?: string;
}

/**
 * Quem enviou. Phase 3 vai resolver isso pra um `Lead` via lookup por
 * telefone dentro do tracking dono da instância.
 */
export interface CanonicalInboundSender {
  /** E.164 sem `+` (ex.: `5586988923098`). */
  readonly phone: string;
  /** Display name vindo do provider (pode estar vazio). */
  readonly displayName?: string;
  /** Indica se a mensagem foi enviada pelo dono do número (atendente). */
  readonly fromMe: boolean;
}

interface InboundBase {
  /** ID externo da mensagem (`wamid...` na Meta, `messageid` na Uazapi). */
  readonly externalMessageId: string;
  /** Timestamp do provider, normalizado pra Date. */
  readonly sentAt: Date;
  /** ID externo da mensagem que está sendo respondida (reply). */
  readonly replyToExternalMessageId?: string;
  /**
   * ID externo da mensagem que está sendo editada. Quando preenchido, a
   * pipeline trata este envelope como uma edição: localiza a mensagem
   * original (por `messageId`), atualiza body/createdAt em vez de criar
   * uma nova. Uazapi expõe via `json.message.edited`; Meta ainda não envia
   * edições por webhook (placeholder pra futura ampliação).
   */
  readonly editedExternalMessageId?: string;
  readonly sender: CanonicalInboundSender;
  readonly instance: CanonicalInboundInstance;
}

export interface CanonicalInboundText extends InboundBase {
  readonly type: "text";
  readonly body: string;
}

/**
 * Inbound de mídia. Pelo menos uma das duas formas de localizar o blob:
 *  - `mediaId`: identifica na origem do provider (ex.: Meta `media_id` →
 *    baixar via `downloadInboundMedia`).
 *  - `mediaUrl`: URL temporária pronta pra GET (Uazapi); pode estar vazia
 *    no Meta (a URL lookaside expira em ~5min — preferir resolver via id).
 */
export interface CanonicalInboundMedia extends InboundBase {
  readonly type: "media";
  readonly kind: "image" | "video" | "audio" | "document" | "sticker";
  readonly mediaId?: string;
  readonly mediaUrl?: string;
  readonly mimetype?: string;
  readonly fileName?: string;
  readonly fileSize?: number;
  readonly caption?: string;
  readonly sha256?: string;
  /** Áudio "voice" / PTT (Meta marca `audio.voice=true`). */
  readonly isVoice?: boolean;
}

export interface CanonicalInboundLocation extends InboundBase {
  readonly type: "location";
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
  readonly address?: string;
}

export interface CanonicalInboundContact extends InboundBase {
  readonly type: "contact";
  readonly contactName: string;
  readonly contactPhone: string;
}

/** Reação (emoji) sobre uma mensagem anterior. */
export interface CanonicalInboundReaction extends InboundBase {
  readonly type: "reaction";
  /** wamid/messageid da mensagem reagida. */
  readonly targetExternalMessageId: string;
  readonly emoji?: string;
}

/** Resposta a botão / lista (interactive). */
export interface CanonicalInboundInteractiveReply extends InboundBase {
  readonly type: "interactive_reply";
  readonly replyId?: string;
  readonly replyText?: string;
}

/** Tipo desconhecido / não-suportado pela aplicação — guardamos como referência. */
export interface CanonicalInboundUnsupported extends InboundBase {
  readonly type: "unsupported";
  readonly providerType?: string;
}

/**
 * Revoke ("apagada para todos") — uma mensagem anterior foi removida pelo
 * autor. A pipeline canônica marca a mensagem alvo (`targetExternalMessageId`)
 * como `MessageStatus.DELETED` e limpa body/mídia. A UI já renderiza como
 * "Mensagem apagada".
 *
 * Uazapi entrega via `messageType: "ProtocolMessage"` com `content.type`
 * indicando REVOKE. Meta atualmente não notifica delete por webhook.
 */
export interface CanonicalInboundRevoke extends InboundBase {
  readonly type: "revoke";
  /** ID externo da mensagem revogada. */
  readonly targetExternalMessageId: string;
}

export type CanonicalInboundMessage =
  | CanonicalInboundText
  | CanonicalInboundMedia
  | CanonicalInboundLocation
  | CanonicalInboundContact
  | CanonicalInboundReaction
  | CanonicalInboundInteractiveReply
  | CanonicalInboundRevoke
  | CanonicalInboundUnsupported;

/**
 * Resultado completo de normalizar um payload de webhook. Pode trazer várias
 * mensagens (Meta agrupa `entry[].changes[].value.messages[]`) + statuses
 * (sent/delivered/read/failed) que Phase 3 pode ignorar inicialmente.
 */
export interface NormalizedInbound {
  readonly messages: ReadonlyArray<CanonicalInboundMessage>;
  /** Atualizações de status (deliveries/reads/falhas) — opcional. */
  readonly statusUpdates?: ReadonlyArray<CanonicalInboundStatusUpdate>;
}

export interface CanonicalInboundStatusUpdate {
  readonly externalMessageId: string;
  readonly status: "sent" | "delivered" | "read" | "failed";
  readonly at: Date;
  readonly recipientPhone?: string;
  readonly errorReason?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Canônico de envio — o que Phase 6 vai passar pro adapter
// ════════════════════════════════════════════════════════════════════════════

interface SendBase {
  /** Destino — E.164 sem `+` (ex.: `5586988923098`). */
  readonly to: string;
  /** Reply: external id da mensagem que estamos respondendo. */
  readonly replyToExternalMessageId?: string;
  /**
   * Quando `true` (default), peça ao provider pra marcar as mensagens
   * anteriores do chat/lead como lidas no celular do destinatário ao
   * enviar — isto é, exibir o "tick azul" pro lead assim que o atendente
   * responde.
   *
   * Uazapi mapeia direto pra `readmessages: true, readchat: true` no
   * payload de envio (todos os endpoints `/send/*`). Meta Cloud API não
   * tem flag equivalente outbound — o adapter ignora.
   *
   * Default `true` preserva o comportamento que o chat Uazapi sempre teve
   * pré-Fase 6 (e que foi acidentalmente perdido na refactor de
   * `router/message/*` que passou a despachar via PORT canônica sem o
   * flag).
   */
  readonly markPreviousAsRead?: boolean;
}

export interface SendCanonicalText extends SendBase {
  readonly kind: "text";
  readonly body: string;
  /** Liga preview de link no Meta (`text.preview_url`). Uazapi: linkPreview. */
  readonly previewUrl?: boolean;
}

export type CanonicalMediaKind =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker";

export interface SendCanonicalMedia extends SendBase {
  readonly kind: "media";
  readonly mediaKind: CanonicalMediaKind;
  /**
   * Ou uma URL pública (preferido pra Uazapi; aceita por Meta como `link`),
   * OU um `mediaId` já uploadado no provider (Meta only). Adapter escolhe
   * o melhor caminho — Uazapi sempre usa URL/base64; Meta usa id se vier.
   */
  readonly mediaUrl?: string;
  readonly mediaId?: string;
  readonly mimetype?: string;
  readonly fileName?: string;
  readonly caption?: string;
}

export interface SendCanonicalLocation extends SendBase {
  readonly kind: "location";
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
  readonly address?: string;
}

export interface SendCanonicalContact extends SendBase {
  readonly kind: "contact";
  readonly fullName: string;
  readonly phoneNumber: string;
  readonly organization?: string;
  readonly email?: string;
}

/**
 * Envio de template HSM (Fase 9) — abre conversa fora da janela de 24h.
 * Conceito exclusivo da Meta Cloud API; `UazapiProvider.sendTemplate` lança
 * `ProviderFeatureUnsupportedError`. Nesta fase só preenchemos variáveis de
 * body e header de texto (uma string por placeholder `{{n}}`, na ordem).
 */
export interface SendCanonicalTemplate extends SendBase {
  readonly kind: "template";
  readonly templateName: string;
  /** Código do idioma exato do template aprovado (ex.: `pt_BR`). */
  readonly languageCode: string;
  readonly bodyParameters?: string[];
  readonly headerParameters?: string[];
}

export type SendCanonicalInput =
  | SendCanonicalText
  | SendCanonicalMedia
  | SendCanonicalLocation
  | SendCanonicalContact
  | SendCanonicalTemplate;

export interface SendResult {
  /** `wamid` (Meta) ou `messageid` (Uazapi) — o que vai pra Message.messageId. */
  readonly externalMessageId: string;
  /** Resposta crua do provider — opaco pra UI, útil pra debug/log. */
  readonly raw: unknown;
}

// ════════════════════════════════════════════════════════════════════════════
// PORT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Identificador semântico do provider. Mantemos como `string` puro
 * (`"uazapi" | "meta-cloud" | (string & {})`) para que registrar um 3º
 * adapter amanhã NÃO exija mexer em enums/sealed unions — basta chamar
 * `registerProvider("custom-v1", builder)`.
 */
export type ProviderId = "uazapi" | "meta-cloud" | (string & {});

/**
 * Header bag genérico — Phase 5 vai entregar os headers HTTP do webhook
 * (lower-cased) pra verificação de assinatura.
 */
export type ProviderWebhookHeaders = Readonly<Record<string, string | undefined>>;

/**
 * A PORT em si. Adapters implementam estes 7 métodos. Métodos podem
 * lançar — Phase 6 envolve as chamadas com try/catch + toast.
 */
export interface WhatsAppChatProvider {
  /** Identificador estável do provider — útil pra logs e branching residual. */
  readonly id: ProviderId;

  // ── Envio ───────────────────────────────────────────────────────────────
  sendText(input: SendCanonicalText): Promise<SendResult>;
  sendMedia(input: SendCanonicalMedia): Promise<SendResult>;
  sendLocation(input: SendCanonicalLocation): Promise<SendResult>;
  sendContact(input: SendCanonicalContact): Promise<SendResult>;
  /**
   * Envia um template HSM aprovado. Só faz sentido na Meta Cloud API —
   * `UazapiProvider` lança `ProviderFeatureUnsupportedError`.
   */
  sendTemplate(input: SendCanonicalTemplate): Promise<SendResult>;

  // ── Webhook inbound ─────────────────────────────────────────────────────

  /**
   * Verifica autenticidade do webhook. Implementações:
   *  - Meta: HMAC SHA-256 do raw body com App Secret (header `x-hub-signature-256`).
   *  - Uazapi: hoje não-validado (provider não assina) → adapter retorna `true`.
   *
   * `rawBody` deve ser EXATAMENTE o texto recebido (sem reparse). Fail-closed:
   * qualquer erro → `false`.
   */
  verifyWebhook(rawBody: string, headers: ProviderWebhookHeaders): boolean;

  /**
   * Converte o payload bruto do webhook (já parseado em objeto) no formato
   * canônico. Retorna `null` se o payload não é desse provider ou está mal
   * formado — Phase 5 pode então tentar outro provider ou logar e ignorar.
   */
  normalizeInbound(rawPayload: unknown): NormalizedInbound | null;
}

// ════════════════════════════════════════════════════════════════════════════
// Config do provider — cada adapter define o seu próprio shape concreto
// ════════════════════════════════════════════════════════════════════════════

/**
 * Config genérica que o factory aceita. Cada adapter casta pro shape dele
 * e valida (recomendado: Zod) na própria fábrica. Mantendo `unknown` aqui
 * é o que permite registrar adapters de fora sem alterar este arquivo.
 */
export type ProviderConfig = unknown;

/**
 * Assinatura da função que cria uma instância do provider a partir da config.
 * Registrada no factory por `providerId`.
 */
export type ProviderBuilder = (config: ProviderConfig) => WhatsAppChatProvider;
