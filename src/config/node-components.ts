import { InitialNode } from "@/components/initial-node";
import { FilterLeadNode } from "@/features/tracking-executions/components/filter-lead/node";
import { HttpRequestNode } from "@/features/tracking-executions/components/http-request/node";
import { MoveLeadNode } from "@/features/tracking-executions/components/move-lead/node";
import { ResponsibleNode } from "@/features/tracking-executions/components/responsible/node";
import { SendMessageNode } from "@/features/tracking-executions/components/send-message/node";
import { TagNode } from "@/features/tracking-executions/components/tag/node";
import { TemperatureNode } from "@/features/tracking-executions/components/temperature/node";
import { WaitNode } from "@/features/tracking-executions/components/wait/node";
import { WinLossNode } from "@/features/tracking-executions/components/win_loss/node";
import { AiFinishedTriggerNode } from "@/features/triggers/components/ai-finished/node";
import { FirstChatInteractionTriggerNode } from "@/features/triggers/components/first-chat-interaction/node";
import { FirstInteractionOfDayTriggerNode } from "@/features/triggers/components/first-interaction-of-day/node";
import { LeadTaggedTriggerNode } from "@/features/triggers/components/lead-tagged/node";
import { ManualTriggerNode } from "@/features/triggers/components/manual-trigger/node";
import { MoveLeadStatusTriggerNode } from "@/features/triggers/components/move-lead-status/node";
import { NewLeadTriggerNode } from "@/features/triggers/components/new-lead-trigger/node";
// ─── "Adicionar Lead no App" — 7 actions de envio (Sprint Automações) ──
import { SendFormNode } from "@/features/tracking-executions/components/send-form/node";
import { SendAgendaNode } from "@/features/tracking-executions/components/send-agenda/node";
import { SendProposalNode } from "@/features/tracking-executions/components/send-proposal/node";
import { SendContractNode } from "@/features/tracking-executions/components/send-contract/node";
import { SendLinnkerNode } from "@/features/tracking-executions/components/send-linnker/node";
import { SendNboxNode } from "@/features/tracking-executions/components/send-nbox/node";
import { SendNasaRouteNode } from "@/features/tracking-executions/components/send-nasa-route/node";
import { OpenFormNode } from "@/features/tracking-executions/components/open-form/node";
// ─── Modo Agente IA — componente genérico pros 14 NodeTypes novos ──
import { AgentNode } from "@/features/tracking-executions/components/agent-node";
import { NodeType } from "@/generated/prisma/enums";
import type { NodeTypes } from "@xyflow/react";

export const nodeComponents = {
  [NodeType.INITIAL]: InitialNode,
  [NodeType.HTTP_REQUEST]: HttpRequestNode,
  [NodeType.MANUAL_TRIGGER]: ManualTriggerNode,
  [NodeType.NEW_LEAD]: NewLeadTriggerNode,
  [NodeType.MOVE_LEAD]: MoveLeadNode,
  [NodeType.SEND_MESSAGE]: SendMessageNode,
  [NodeType.WAIT]: WaitNode,
  [NodeType.WIN_LOSS]: WinLossNode,
  [NodeType.TAG]: TagNode,
  [NodeType.TEMPERATURE]: TemperatureNode,
  [NodeType.RESPONSIBLE]: ResponsibleNode,
  [NodeType.MOVE_LEAD_STATUS]: MoveLeadStatusTriggerNode,
  [NodeType.LEAD_TAGGED]: LeadTaggedTriggerNode,
  [NodeType.AI_FINISHED]: AiFinishedTriggerNode,
  [NodeType.FIRST_CHAT_INTERACTION]: FirstChatInteractionTriggerNode,
  [NodeType.FIRST_INTERACTION_OF_DAY]: FirstInteractionOfDayTriggerNode,
  [NodeType.FILTER_LEAD]: FilterLeadNode,
  // ─── Adicionar Lead no App ───
  [NodeType.SEND_FORM]: SendFormNode,
  [NodeType.SEND_AGENDA]: SendAgendaNode,
  [NodeType.SEND_PROPOSAL]: SendProposalNode,
  [NodeType.SEND_CONTRACT]: SendContractNode,
  [NodeType.SEND_LINNKER]: SendLinnkerNode,
  [NodeType.SEND_NBOX]: SendNboxNode,
  [NodeType.SEND_NASA_ROUTE]: SendNasaRouteNode,
  [NodeType.OPEN_FORM]: OpenFormNode,
  // ─── Modo Agente IA — todos usam o AgentNode genérico com editor JSON ──
  // Fase 4 vai substituir por componentes dedicados com formulários visuais.
  [NodeType.IF_CONDITION]: AgentNode,
  [NodeType.SWITCH_CASE]: AgentNode,
  [NodeType.LOOP_OVER]: AgentNode,
  [NodeType.MERGE]: AgentNode,
  [NodeType.WAIT_FOR_EVENT]: AgentNode,
  [NodeType.AI_DECISION]: AgentNode,
  [NodeType.AI_GENERATE_TEXT]: AgentNode,
  [NodeType.AI_VISION]: AgentNode,
  [NodeType.READ_PDF]: AgentNode,
  [NodeType.SET_VARIABLE]: AgentNode,
  [NodeType.CALL_WORKFLOW]: AgentNode,
  [NodeType.CHECK_PAYMENT]: AgentNode,
  [NodeType.SEND_VOICE]: AgentNode,
  [NodeType.SEND_MEDIA]: AgentNode,
  [NodeType.WEB_SEARCH]: AgentNode,
  [NodeType.PAYMENT_RECEIVED]: AgentNode,
  [NodeType.MESSAGE_INCOMING]: AgentNode,
  [NodeType.WEBHOOK_EXTERNAL]: AgentNode,
} as const satisfies NodeTypes;

export type RegisteredNodeTypes = keyof typeof nodeComponents;
