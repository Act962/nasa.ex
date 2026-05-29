/**
 * Registry de executors do Modo Agente IA. Mapeia NodeType → NodeExecutor
 * pra ser passado ao `runWorkflow`.
 *
 * Built-in (lógica pura tratada direto no run-workflow.ts):
 *   IF_CONDITION, SWITCH_CASE, LOOP_OVER, MERGE, SET_VARIABLE
 *
 * Trigger nodes (não executam, só rotulam entrada):
 *   PAYMENT_RECEIVED, MESSAGE_INCOMING, WEBHOOK_EXTERNAL,
 *   NEW_LEAD, LEAD_TAGGED, MOVE_LEAD_STATUS, etc.
 *
 * Executors externos (este arquivo wireia):
 *   IA → AI_DECISION, AI_GENERATE_TEXT, AI_VISION, READ_PDF
 *   Controle → WAIT_FOR_EVENT, CALL_WORKFLOW
 *   Apps → CHECK_PAYMENT, SEND_VOICE, SEND_MEDIA
 *
 * NÃO incluímos os executors antigos do tracking (SEND_MESSAGE, MOVE_LEAD,
 * SEND_PROPOSAL, etc.) — eles ficam responsabilidade do
 * `workspace-workflow-executor.ts` legado, que será delegado pro engine
 * novo quando `workflow.agentMode = true` mas mantém o catálogo de
 * executors clássicos via wrapper (Fase 4).
 */
import "server-only";
import type { NodeExecutor } from "./run-workflow";
import {
  aiDecisionExecutor,
  aiGenerateTextExecutor,
  aiVisionExecutor,
  readPdfExecutor,
} from "./agent-executors/ai";
import {
  waitForEventExecutor,
  callWorkflowExecutor,
} from "./agent-executors/control";
import {
  checkPaymentExecutor,
  sendVoiceExecutor,
  sendMediaExecutor,
  sendMessageExecutor,
  tagExecutor,
} from "./agent-executors/apps";
import { webSearchExecutor } from "./agent-executors/web-search";

/**
 * Mapa principal usado pelo `runWorkflow`. Use `getAgentExecutorRegistry()`
 * em vez de exportar a Map diretamente pra permitir override em testes
 * (dry-run com executors mockados, por exemplo).
 */
export function getAgentExecutorRegistry(): Map<string, NodeExecutor> {
  return new Map<string, NodeExecutor>([
    // IA
    ["AI_DECISION", aiDecisionExecutor],
    ["AI_GENERATE_TEXT", aiGenerateTextExecutor],
    ["AI_VISION", aiVisionExecutor],
    ["READ_PDF", readPdfExecutor],
    // Controle
    ["WAIT_FOR_EVENT", waitForEventExecutor],
    ["CALL_WORKFLOW", callWorkflowExecutor],
    // Apps NASA
    ["CHECK_PAYMENT", checkPaymentExecutor],
    ["SEND_VOICE", sendVoiceExecutor],
    ["SEND_MEDIA", sendMediaExecutor],
    ["SEND_MESSAGE", sendMessageExecutor],
    ["TAG", tagExecutor],
    // Web Search (Gemini Grounding + OpenAI fallback)
    ["WEB_SEARCH", webSearchExecutor],
  ]);
}
