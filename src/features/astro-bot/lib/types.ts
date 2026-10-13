/**
 * Tipos compartilhados do Astro Bot via WhatsApp.
 *
 * Interface `WhatsappBotChannel` abstrai o provider (UAZAPI vs Meta Cloud),
 * pra que toda lógica de negócio (auth, routing, output) não precise saber
 * de qual canal está usando. Trocar de tier vira só swap de implementação.
 */
import "server-only";

/** Opção clicável de uma resposta do bot. O `id` volta no clique (webhook `interactive_reply`). */
export interface BotButton {
  id: string;
  text: string;
  /** Subtítulo da linha, só em lista. */
  description?: string;
  /** Só aparece onde há botão de verdade; em lista numerada seria ruído ("1. Menu 2. Encerrar"). */
  interactiveOnly?: boolean;
}

export interface ButtonPayload {
  bodyText: string;
  footerText?: string;
  buttons: BotButton[];
  /** Texto do botão que abre a lista, quando as opções não cabem em 3 botões. */
  listButtonLabel?: string;
  /** Sem a espera que imita digitação: quem mandou áudio já esperou a transcrição e a voz (spec 0083). */
  isImmediate?: boolean;
}

export interface WhatsappBotChannel {
  /** Envia mensagem de texto. Quebra em múltiplas se > 4000 chars. */
  sendText(phone: string, text: string, options?: { isImmediate?: boolean }): Promise<{ messageId: string | null }>;
  /** Envia pergunta com opções: botões ou lista onde o provider aceita, lista numerada onde não. */
  sendButtons(phone: string, payload: ButtonPayload): Promise<{ messageId: string | null }>;
  /** Envia imagem com legenda por URL pública (prévia de post do Planner, spec 0064). */
  sendMedia(phone: string, media: { url: string; caption?: string }): Promise<{ messageId: string | null }>;
  /** Envia nota de voz (OGG/Opus). Lança se o provider não aceitar (spec 0083). */
  sendVoice(phone: string, voice: { audio: Buffer; mimetype: string }): Promise<{ messageId: string | null }>;
  /** Mostra typing indicator (humaniza respostas longas). */
  sendTyping(phone: string, durationMs: number): Promise<void>;
}

export type BotCommandStatus =
  | "ok"
  | "empty_reply"
  | "rate_limited"
  | "quiet_hours"
  | "pin_required"
  | "pin_locked"
  | "session_expired"
  | "tool_denied"
  | "error_orchestrator"
  | "binding_inactive"
  | "binding_not_found"
  | "stars_insufficient"
  | "media_unsupported"
  | "media_forbidden"
  | "media_failed"
  /** "Errou" e a resposta a "o que era o certo?" (spec 0073) — fora do histórico. */
  | "feedback";

/** Documento/imagem enviado por membro allow-listado (spec 0019). */
export interface BotInboundMedia {
  /** `messageid` na Uazapi, `wamid` na Meta. */
  externalMessageId: string;
  /** `media_id` da Graph API — só Meta. */
  mediaId?: string;
  kind: "document" | "image" | "audio";
  mimetype?: string;
  fileName?: string;
  caption?: string;
}

/** Resultado da resolução de um comando inbound. */
export interface BotCommandResult {
  status: BotCommandStatus;
  /** Texto de resposta a mandar pro user. Sempre presente — mesmo em erro. */
  reply: string;
  /** Tools chamadas pela orquestração (pro audit log). */
  /** Opções clicáveis; sem isto a escolha volta como lista numerada. */
  buttons?: BotButton[];
  listButtonLabel?: string;
  toolsCalled?: string[];
  tokensUsed?: number;
  starsCharged?: number;
  /** A mensagem chegou como áudio: decide a resposta em voz no modo "quando eu mandar áudio" (spec 0083). */
  wasAudioInput?: boolean;
  /** Empresa isenta de Stars neste comando (ex.: trafeGO). */
  isBillingExempt?: boolean;
  /** Linha do registro deste comando, para anotar a resposta em voz. */
  commandLogId?: string;
}
