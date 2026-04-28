import { WsInitialNode } from "@/features/workspace-executions/components/ws-initial-node";
import { NodeType } from "@/generated/prisma/enums";
import type { NodeTypes } from "@xyflow/react";

import { WsManualTriggerNode } from "@/features/workspace-triggers/components/manual-trigger/node";
import { WsActionCreatedNode } from "@/features/workspace-triggers/components/action-created/node";
import { WsActionMovedColumnNode } from "@/features/workspace-triggers/components/action-moved-column/node";
import { WsActionTaggedNode } from "@/features/workspace-triggers/components/action-tagged/node";
import { WsActionCompletedNode } from "@/features/workspace-triggers/components/action-completed/node";
import { WsActionParticipantAddedNode } from "@/features/workspace-triggers/components/action-participant-added/node";

import { WsCreateActionNode } from "@/features/workspace-executions/components/create-action/node";
import { WsMoveActionNode } from "@/features/workspace-executions/components/move-action/node";
import { WsAddTagActionNode } from "@/features/workspace-executions/components/add-tag-action/node";
import { WsAddParticipantNode } from "@/features/workspace-executions/components/add-participant/node";
import { WsSetResponsibleNode } from "@/features/workspace-executions/components/set-responsible/node";
import { WsCreateSubActionNode } from "@/features/workspace-executions/components/create-sub-action/node";
import { WsSendMessageParticipantsNode } from "@/features/workspace-executions/components/send-message-participants/node";
import { WsSendEmailParticipantsNode } from "@/features/workspace-executions/components/send-email-participants/node";
import { WsArchiveActionNode } from "@/features/workspace-executions/components/archive-action/node";
import { WsWaitNode } from "@/features/workspace-executions/components/wait/node";
import { WsFilterNode } from "@/features/workspace-executions/components/filter/node";

export const workspaceNodeComponents = {
  [NodeType.WS_INITIAL]: WsInitialNode,
  [NodeType.WS_MANUAL_TRIGGER]: WsManualTriggerNode,
  [NodeType.WS_ACTION_CREATED]: WsActionCreatedNode,
  [NodeType.WS_ACTION_MOVED_COLUMN]: WsActionMovedColumnNode,
  [NodeType.WS_ACTION_TAGGED]: WsActionTaggedNode,
  [NodeType.WS_ACTION_COMPLETED]: WsActionCompletedNode,
  [NodeType.WS_ACTION_PARTICIPANT_ADDED]:
    WsActionParticipantAddedNode,
  [NodeType.WS_CREATE_ACTION]: WsCreateActionNode,
  [NodeType.WS_MOVE_ACTION]: WsMoveActionNode,
  [NodeType.WS_ADD_TAG_ACTION]: WsAddTagActionNode,
  [NodeType.WS_ADD_PARTICIPANT]: WsAddParticipantNode,
  [NodeType.WS_SET_RESPONSIBLE]: WsSetResponsibleNode,
  [NodeType.WS_CREATE_SUB_ACTION]: WsCreateSubActionNode,
  [NodeType.WS_SEND_MESSAGE_PARTICIPANTS]:
    WsSendMessageParticipantsNode,
  [NodeType.WS_SEND_EMAIL_PARTICIPANTS]: WsSendEmailParticipantsNode,
  [NodeType.WS_ARCHIVE_ACTION]: WsArchiveActionNode,
  [NodeType.WS_WAIT]: WsWaitNode,
  [NodeType.WS_FILTER]: WsFilterNode,
} as const satisfies Partial<NodeTypes>;

export type WorkspaceRegisteredNodeTypes = keyof typeof workspaceNodeComponents;
