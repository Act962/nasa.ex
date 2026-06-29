/**
 * Tipos compartilhados do Astro Bot via WhatsApp.
 *
 * Interface `WhatsappBotChannel` abstrai o provider (UAZAPI vs Meta Cloud),
 * pra que toda lógica de negócio (auth, routing, output) não precise saber
 * de qual canal está usando. Trocar de tier vira só swap de implementação.
 */
import "server-only";

export interface ButtonPayload {
  bodyText: string;
  footerText?: string;
  buttons: Array<{ id: string; text: string }>;
}

export interface WhatsappBotChannel {
  /** Envia mensagem de texto. Quebra em múltiplas se > 4000 chars. */
  sendText(phone: string, text: string): Promise<{ messageId: string | null }>;
  /** Envia menu de até 3 botões interativos (confirmações destrutivas). */
  sendButtons(phone: string, payload: ButtonPayload): Promise<{ messageId: string | null }>;
  /** Mostra typing indicator (humaniza respostas longas). */
  sendTyping(phone: string, durationMs: number): Promise<void>;
}

export type BotCommandStatus =
  | "ok"
  | "rate_limited"
  | "quiet_hours"
  | "pin_required"
  | "pin_locked"
  | "session_expired"
  | "tool_denied"
  | "error_orchestrator"
  | "binding_inactive"
  | "binding_not_found";

/** Resultado da resolução de um comando inbound. */
export interface BotCommandResult {
  status: BotCommandStatus;
  /** Texto de resposta a mandar pro user. Sempre presente — mesmo em erro. */
  reply: string;
  /** Tools chamadas pela orquestração (pro audit log). */
  toolsCalled?: string[];
  tokensUsed?: number;
  starsCharged?: number;
}
