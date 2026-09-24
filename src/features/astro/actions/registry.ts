import "server-only";
import type { AstroAction } from "./types";
import { createProposalAction } from "./forge/create-proposal";
import { rescheduleAppointmentAction } from "./agenda/reschedule-appointment";
import { deleteLeadAction } from "./leads/delete-lead";
import { addLeadNoteAction } from "./leads/add-lead-note";
import { cancelAppointmentAction } from "./agenda/cancel-appointment";
import { toggleLeadFavoriteAction } from "./leads/toggle-favorite";
import { createStatusAction } from "./tracking/create-status";

// Fonte única das ações do Astro (spec 0023, RF-1/RF-2). Entrar aqui basta:
// o orquestrador ganha a ferramenta, o classificador ganha o alvo e o executor
// por regex ganha o destino, sem código duplicado em nenhum dos três.

export const ASTRO_ACTIONS: AstroAction[] = [
  createProposalAction,
  rescheduleAppointmentAction,
  deleteLeadAction,
  addLeadNoteAction,
  cancelAppointmentAction,
  toggleLeadFavoriteAction,
  createStatusAction,
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
