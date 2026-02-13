import { InitialNode } from "@/components/initial-node";
import { HttpRequestNode } from "@/features/executions/components/http-request/node";
import { MoveLeadNode } from "@/features/executions/components/move-lead/node";
import { ResponsibleNode } from "@/features/executions/components/responsible/node";
import { SendMessageNode } from "@/features/executions/components/send-message/node";
import { TagNode } from "@/features/executions/components/tag/node";
import { TemperatureNode } from "@/features/executions/components/temperature/node";
import { WaitNode } from "@/features/executions/components/wait/node";
import { WinLossNode } from "@/features/executions/components/win_loss/node";
import { ManualTriggerNode } from "@/features/triggers/components/manual-trigger/node";
import { MoveLeadStatusTriggerNode } from "@/features/triggers/components/move-lead-status/node";
import { NewLeadTriggerNode } from "@/features/triggers/components/new-lead-trigger/node";
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
} as const satisfies NodeTypes;

export type RegisteredNodeTypes = keyof typeof nodeComponents;
