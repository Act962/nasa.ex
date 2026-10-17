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
 *   Controle → WAIT_FOR_EVENT, CALL_WORKFLOW, FILTER_LEAD
 *   Apps → CHECK_PAYMENT, SEND_VOICE, SEND_MEDIA
 *
 * Passos do modo normal sem versão própria aqui (Temperatura, Responsável, Ganho/Perda, HTTP,
 * envios de app etc.) entram pelo executor clássico, via `runClassicNodeInAgentMode`.
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
  sendProposalExecutor,
  sendContractExecutor,
  moveLeadExecutor,
} from "./agent-executors/apps";
import { webSearchExecutor } from "./agent-executors/web-search";
import { sendEmailExecutor } from "./agent-executors/email";
import { seiActionAgentExecutor } from "./agent-executors/sei";
import { notifyTeamExecutor } from "./agent-executors/notify-team";
import { filterLeadAgentExecutor } from "./agent-executors/filter-lead";
import { runClassicNodeInAgentMode } from "./agent-executors/classic-node";
import { executorRegistry as classicExecutorRegistry } from "@/features/tracking-executions/lib/executor-registry";
import {
  catalogOrderActionExecutor,
  checkCreditExecutor,
  findCustomerByDocumentExecutor,
  routeToConsultantExecutor,
  salesApprovalExecutor,
} from "./agent-executors/catalog-sales";

// COMPLIANCE_ITEM_DUE ainda não está na lista de gatilhos de `run-workflow.ts`;
// como nó de entrada ele só repassa para a saída principal.
const complianceItemDueTriggerExecutor: NodeExecutor = async ({ nodeType }) => ({
  output: { triggered: true, triggerType: nodeType },
  chosenOutput: "main",
  status: "SUCCESS",
});

/**
 * Mapa principal usado pelo `runWorkflow`. Use `getAgentExecutorRegistry()`
 * em vez de exportar a Map diretamente pra permitir override em testes
 * (dry-run com executors mockados, por exemplo).
 */
export function getAgentExecutorRegistry(): Map<string, NodeExecutor> {
  const registry = new Map<string, NodeExecutor>([
    // IA
    ["AI_DECISION", aiDecisionExecutor],
    ["AI_GENERATE_TEXT", aiGenerateTextExecutor],
    ["AI_VISION", aiVisionExecutor],
    ["READ_PDF", readPdfExecutor],
    // Controle
    ["WAIT_FOR_EVENT", waitForEventExecutor],
    ["CALL_WORKFLOW", callWorkflowExecutor],
    ["FILTER_LEAD", filterLeadAgentExecutor],
    // Apps NASA
    ["CHECK_PAYMENT", checkPaymentExecutor],
    ["SEND_VOICE", sendVoiceExecutor],
    ["SEND_MEDIA", sendMediaExecutor],
    ["SEND_MESSAGE", sendMessageExecutor],
    ["TAG", tagExecutor],
    ["MOVE_LEAD", moveLeadExecutor],
    ["SEND_PROPOSAL", sendProposalExecutor],
    ["SEND_CONTRACT", sendContractExecutor],
    // Web Search (Gemini Grounding + OpenAI fallback)
    ["WEB_SEARCH", webSearchExecutor],
    // Email transacional (Resend + React Email)
    ["SEND_EMAIL", sendEmailExecutor],
    ["SEI_ACTION", seiActionAgentExecutor],
    // Construtor rápido (spec 0039)
    ["NOTIFY_TEAM", notifyTeamExecutor],
    // Venda guiada pelo catálogo (spec 0104)
    ["SALES_APPROVAL", salesApprovalExecutor],
    ["CHECK_CREDIT", checkCreditExecutor],
    ["FIND_CUSTOMER_BY_DOCUMENT", findCustomerByDocumentExecutor],
    ["ROUTE_TO_CONSULTANT", routeToConsultantExecutor],
    ["CATALOG_ORDER_ACTION", catalogOrderActionExecutor],
    // Gatilho da aba Contábil (spec 0051)
    ["COMPLIANCE_ITEM_DUE", complianceItemDueTriggerExecutor],
  ]);

  // Paridade com o modo normal (spec 0112): passo do motor clássico sem versão própria aqui roda
  // pelo executor clássico. Gatilhos e "Esperar" nem chegam ao registry (o motor trata antes).
  for (const [nodeType, classicExecutor] of Object.entries(classicExecutorRegistry)) {
    if (!classicExecutor || registry.has(nodeType)) continue;
    registry.set(nodeType, runClassicNodeInAgentMode(classicExecutor));
  }
  return registry;
}
