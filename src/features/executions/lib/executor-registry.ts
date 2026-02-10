import { NodeType } from "@/generated/prisma/enums";
import { NodeExecutor } from "../types";
import { manualTriggerExecutor } from "@/features/triggers/components/manual-trigger/executor";
import { httpRequestExecutor } from "../components/http-request/executor";
import { newLeadTriggerExecutor } from "@/features/triggers/components/new-lead-trigger/executor";
import { moveLeadExecutor } from "../components/move-lead/executor";
import { sendMessageExecutor } from "../components/send-message/executor";
import { waitExecutor } from "../components/wait/executor";
import { winLossExecutor } from "../components/win_loss/executor";
import { tagExecutor } from "../components/tag/executor";

export const executorRegistry: Record<NodeType, NodeExecutor> = {
  [NodeType.INITIAL]: manualTriggerExecutor,
  [NodeType.MANUAL_TRIGGER]: manualTriggerExecutor,
  [NodeType.HTTP_REQUEST]: httpRequestExecutor,
  [NodeType.NEW_LEAD]: newLeadTriggerExecutor,
  [NodeType.MOVE_LEAD]: moveLeadExecutor,
  [NodeType.SEND_MESSAGE]: sendMessageExecutor,
  [NodeType.WAIT]: waitExecutor,
  [NodeType.WIN_LOSS]: winLossExecutor,
  [NodeType.TAG]: tagExecutor,
};

export const getExecutor = (type: NodeType): NodeExecutor => {
  const executor = executorRegistry[type];

  if (!executor) {
    throw new Error(`No executor found for node type: ${type}`);
  }

  return executor;
};
