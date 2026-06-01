/**
 * Action keys cobrados pelo Modo Agente IA. Cada chave é olhada em
 * `AppStarCost.appSlug` por `chargeStarsByAction`. Se o admin não cadastrou
 * a regra em `/admin/stars > Regras`, o débito é skipped (cost=0) — Modo
 * Agente roda gratuito até admin definir.
 *
 * Defaults sugeridos (admin pode mudar):
 *   ai_decision_made     → 1 ★
 *   ai_text_generated    → 1 ★
 *   ai_vision_analyzed   → 3 ★
 *   pdf_read             → 2 ★
 *   web_search_executed  → 2 ★ (Fase 6)
 *   send_voice_generated → 1 ★
 *   send_media_uploaded  → 1 ★
 *   check_payment_query  → 0 ★ (gratuito — só consulta DB)
 */
export const AGENT_STARS_ACTIONS = {
  AI_DECISION: "ai_decision_made",
  AI_TEXT: "ai_text_generated",
  AI_VISION: "ai_vision_analyzed",
  PDF_READ: "pdf_read",
  WEB_SEARCH: "web_search_executed",
  SEND_VOICE: "send_voice_generated",
  SEND_MEDIA: "send_media_uploaded",
  CHECK_PAYMENT: "check_payment_query",
  SEND_EMAIL: "send_email_transactional",
} as const;

export type AgentStarsAction =
  (typeof AGENT_STARS_ACTIONS)[keyof typeof AGENT_STARS_ACTIONS];
