import "server-only";
import type { AstroAction } from "./types";
import { createProposalAction } from "./forge/create-proposal";
import { rescheduleAppointmentAction } from "./agenda/reschedule-appointment";
import { deleteLeadAction } from "./leads/delete-lead";
import { addLeadNoteAction } from "./leads/add-lead-note";
import { createLeadAction } from "./leads/create-lead";
import { createTrackingAction } from "./tracking/create-tracking";
import { createAgendaAction } from "./agenda/create-agenda";
import { createAppointmentAction } from "./agenda/create-appointment";
import { createWorkspaceAction } from "./workspace/create-workspace";
import { cancelAppointmentAction } from "./agenda/cancel-appointment";
import { toggleLeadFavoriteAction } from "./leads/toggle-favorite";
import { createStatusAction } from "./tracking/create-status";
import { markChatReadAction } from "./chat/mark-read";
import { startConversationAction } from "./chat/start-conversation";
import { sendTemplateAction } from "./chat/send-template";
import { forwardMessageAction } from "./chat/forward-message";
import { renameStatusAction } from "./tracking/rename-status";
import { archiveTrackingAction } from "./tracking/archive-tracking";
import { toggleAgendaActiveAction } from "./agenda/toggle-active";
import { blockAgendaDateAction } from "./agenda/block-date";
import { createReminderAction } from "./agenda/create-reminder";
import { addTrackingParticipantAction } from "./tracking/add-participant";
import { sendFormToLeadAction } from "./form/send-to-lead";
import { toggleFormPublishAction } from "./form/toggle-publish";

// Fonte única das ações do Astro (spec 0023, RF-1/RF-2). Entrar aqui basta:
// o orquestrador ganha a ferramenta, o classificador ganha o alvo e o executor
// por regex ganha o destino, sem código duplicado em nenhum dos três.

export const ASTRO_ACTIONS: AstroAction[] = [
  createProposalAction,
  rescheduleAppointmentAction,
  deleteLeadAction,
  addLeadNoteAction,
  createLeadAction,
  createTrackingAction,
  createAgendaAction,
  createAppointmentAction,
  createWorkspaceAction,
  cancelAppointmentAction,
  toggleLeadFavoriteAction,
  createStatusAction,
  markChatReadAction,
  startConversationAction,
  sendTemplateAction,
  forwardMessageAction,
  renameStatusAction,
  archiveTrackingAction,
  toggleAgendaActiveAction,
  blockAgendaDateAction,
  createReminderAction,
  addTrackingParticipantAction,
  sendFormToLeadAction,
  toggleFormPublishAction,
];

const actionsByKey = new Map(ASTRO_ACTIONS.map((action) => [action.key, action]));
const actionsByToolName = new Map(
  ASTRO_ACTIONS.map((action) => [action.toolName, action]),
);

export function getAstroAction(key: string): AstroAction | undefined {
  return actionsByKey.get(key);
}

export function getAstroActionByToolName(toolName: string): AstroAction | undefined {
  return actionsByToolName.get(toolName);
}
