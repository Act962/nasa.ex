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
import { temperatureExecutor } from "../components/temperature/executor";
import { responsibleExecutor } from "../components/responsible/executor";
import { moveLeadStatusTriggerExecutor } from "@/features/triggers/components/move-lead-status/executor";
import { leadTaggedTriggerExecutor } from "@/features/triggers/components/lead-tagged/executor";
import { aiFinishedTriggerExecutor } from "@/features/triggers/components/ai-finished/executor";
import { firstChatInteractionTriggerExecutor } from "@/features/triggers/components/first-chat-interaction/executor";
import { firstInteractionOfDayTriggerExecutor } from "@/features/triggers/components/first-interaction-of-day/executor";
import { filterLeadExecutor } from "../components/filter-lead/executor";
// ─── "Adicionar Lead no App" — 7 actions de envio (Sprint Automações) ──
import { sendFormExecutor } from "../components/send-form/executor";
import { sendAgendaExecutor } from "../components/send-agenda/executor";
import { sendProposalExecutor } from "../components/send-proposal/executor";
import { sendContractExecutor } from "../components/send-contract/executor";
import { sendLinnkerExecutor } from "../components/send-linnker/executor";
import { sendNboxExecutor } from "../components/send-nbox/executor";
import { sendNasaRouteExecutor } from "../components/send-nasa-route/executor";
import { openFormExecutor } from "../components/open-form/executor";

export const executorRegistry: Partial<Record<NodeType, NodeExecutor>> = {
  [NodeType.INITIAL]: manualTriggerExecutor,
  [NodeType.MANUAL_TRIGGER]: manualTriggerExecutor,
  [NodeType.HTTP_REQUEST]: httpRequestExecutor,
  [NodeType.NEW_LEAD]: newLeadTriggerExecutor,
  [NodeType.MOVE_LEAD]: moveLeadExecutor,
  [NodeType.SEND_MESSAGE]: sendMessageExecutor,
  [NodeType.WAIT]: waitExecutor,
  [NodeType.WIN_LOSS]: winLossExecutor,
  [NodeType.TAG]: tagExecutor,
  [NodeType.TEMPERATURE]: temperatureExecutor,
  [NodeType.RESPONSIBLE]: responsibleExecutor,
  [NodeType.MOVE_LEAD_STATUS]: moveLeadStatusTriggerExecutor,
  [NodeType.LEAD_TAGGED]: leadTaggedTriggerExecutor,
  [NodeType.AI_FINISHED]: aiFinishedTriggerExecutor,
  [NodeType.FIRST_CHAT_INTERACTION]: firstChatInteractionTriggerExecutor,
  [NodeType.FIRST_INTERACTION_OF_DAY]: firstInteractionOfDayTriggerExecutor,
  [NodeType.FILTER_LEAD]: filterLeadExecutor,
  // ─── Adicionar Lead no App ───
  [NodeType.SEND_FORM]: sendFormExecutor as NodeExecutor,
  [NodeType.SEND_AGENDA]: sendAgendaExecutor as NodeExecutor,
  [NodeType.SEND_PROPOSAL]: sendProposalExecutor as NodeExecutor,
  [NodeType.SEND_CONTRACT]: sendContractExecutor as NodeExecutor,
  [NodeType.SEND_LINNKER]: sendLinnkerExecutor as NodeExecutor,
  [NodeType.SEND_NBOX]: sendNboxExecutor as NodeExecutor,
  [NodeType.SEND_NASA_ROUTE]: sendNasaRouteExecutor as NodeExecutor,
  [NodeType.OPEN_FORM]: openFormExecutor as NodeExecutor,
};

export const getExecutor = (type: NodeType): NodeExecutor => {
  const executor = executorRegistry[type];

  if (!executor) {
    throw new Error(`No executor found for node type: ${type}`);
  }

  return executor;
};
