import { InitialNode } from "@/components/initial-node";
import { FilterLeadNode } from "@/features/executions/components/filter-lead/node";
import { HttpRequestNode } from "@/features/executions/components/http-request/node";
import { MoveLeadNode } from "@/features/executions/components/move-lead/node";
import { ResponsibleNode } from "@/features/executions/components/responsible/node";
import { SendMessageNode } from "@/features/executions/components/send-message/node";
import { TagNode } from "@/features/executions/components/tag/node";
import { TemperatureNode } from "@/features/executions/components/temperature/node";
import { WaitNode } from "@/features/executions/components/wait/node";
import { WinLossNode } from "@/features/executions/components/win_loss/node";
import { AiFinishedTriggerNode } from "@/features/triggers/components/ai-finished/node";
import { FirstChatInteractionTriggerNode } from "@/features/triggers/components/first-chat-interaction/node";
import { LeadTaggedTriggerNode } from "@/features/triggers/components/lead-tagged/node";
import { ManualTriggerNode } from "@/features/triggers/components/manual-trigger/node";
import { MoveLeadStatusTriggerNode } from "@/features/triggers/components/move-lead-status/node";
import { NewLeadTriggerNode } from "@/features/triggers/components/new-lead-trigger/node";
// ─── "Adicionar Lead no App" — 7 actions de envio (Sprint Automações) ──
import { SendFormNode } from "@/features/executions/components/send-form/node";
import { SendAgendaNode } from "@/features/executions/components/send-agenda/node";
import { SendProposalNode } from "@/features/executions/components/send-proposal/node";
import { SendContractNode } from "@/features/executions/components/send-contract/node";
import { SendLinnkerNode } from "@/features/executions/components/send-linnker/node";
import { SendNboxNode } from "@/features/executions/components/send-nbox/node";
import { SendNasaRouteNode } from "@/features/executions/components/send-nasa-route/node";
import { OpenFormNode } from "@/features/executions/components/open-form/node";
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
} as const satisfies NodeTypes;

export type RegisteredNodeTypes = keyof typeof nodeComponents;
