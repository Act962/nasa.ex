import { NodeType } from "@/generated/prisma/enums";
import { NodeExecutor } from "@/features/workspace-executions/types";
import { wsInitialExecutor } from "./initial-executor";
import { wsManualTriggerExecutor } from "@/features/workspace-triggers/components/manual-trigger/executor";
import { wsActionCreatedExecutor } from "@/features/workspace-triggers/components/action-created/executor";
import { wsActionMovedColumnExecutor } from "@/features/workspace-triggers/components/action-moved-column/executor";
import { wsActionTaggedExecutor } from "@/features/workspace-triggers/components/action-tagged/executor";
import { wsActionCompletedExecutor } from "@/features/workspace-triggers/components/action-completed/executor";
import { wsActionParticipantAddedExecutor } from "@/features/workspace-triggers/components/action-participant-added/executor";
import { wsCreateActionExecutor } from "../components/create-action/executor";
import { wsMoveActionExecutor } from "../components/move-action/executor";
import { wsAddTagActionExecutor } from "../components/add-tag-action/executor";
import { wsAddParticipantExecutor } from "../components/add-participant/executor";
import { wsSetResponsibleExecutor } from "../components/set-responsible/executor";
import { wsCreateSubActionExecutor } from "../components/create-sub-action/executor";
import { wsSendMessageParticipantsExecutor } from "../components/send-message-participants/executor";
import { wsSendEmailParticipantsExecutor } from "../components/send-email-participants/executor";
import { wsArchiveActionExecutor } from "../components/archive-action/executor";
import { wsWaitExecutor } from "../components/wait/executor";
import { wsFilterExecutor } from "../components/filter/executor";

export const wsExecutorRegistry: Partial<Record<NodeType, NodeExecutor>> = {
  [NodeType.WS_INITIAL]: wsInitialExecutor,
  [NodeType.WS_MANUAL_TRIGGER]: wsManualTriggerExecutor,
  [NodeType.WS_ACTION_CREATED]: wsActionCreatedExecutor,
  [NodeType.WS_ACTION_MOVED_COLUMN]: wsActionMovedColumnExecutor,
  [NodeType.WS_ACTION_TAGGED]: wsActionTaggedExecutor,
  [NodeType.WS_ACTION_COMPLETED]: wsActionCompletedExecutor,
  [NodeType.WS_ACTION_PARTICIPANT_ADDED]:
    wsActionParticipantAddedExecutor,
  [NodeType.WS_CREATE_ACTION]: wsCreateActionExecutor,
  [NodeType.WS_MOVE_ACTION]: wsMoveActionExecutor,
  [NodeType.WS_ADD_TAG_ACTION]: wsAddTagActionExecutor,
  [NodeType.WS_ADD_PARTICIPANT]: wsAddParticipantExecutor,
  [NodeType.WS_SET_RESPONSIBLE]: wsSetResponsibleExecutor,
  [NodeType.WS_CREATE_SUB_ACTION]: wsCreateSubActionExecutor,
  [NodeType.WS_SEND_MESSAGE_PARTICIPANTS]:
    wsSendMessageParticipantsExecutor,
  [NodeType.WS_SEND_EMAIL_PARTICIPANTS]:
    wsSendEmailParticipantsExecutor,
  [NodeType.WS_ARCHIVE_ACTION]: wsArchiveActionExecutor,
  [NodeType.WS_WAIT]: wsWaitExecutor,
  [NodeType.WS_FILTER]: wsFilterExecutor,
};

export function getWorkspaceExecutor(type: NodeType): NodeExecutor {
  const executor = wsExecutorRegistry[type];
  if (!executor) {
    throw new Error(`No executor found for workspace node type: ${type}`);
  }
  return executor;
}
