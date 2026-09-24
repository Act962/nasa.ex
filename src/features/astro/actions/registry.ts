import "server-only";
import type { AstroAction } from "./types";
import { createProposalAction } from "./forge/create-proposal";
import { rescheduleAppointmentAction } from "./agenda/reschedule-appointment";

// Fonte única das ações do Astro (spec 0023, RF-1/RF-2). Entrar aqui basta:
// o orquestrador ganha a ferramenta, o classificador ganha o alvo e o executor
// por regex ganha o destino, sem código duplicado em nenhum dos três.

export const ASTRO_ACTIONS: AstroAction[] = [
  createProposalAction,
  rescheduleAppointmentAction,
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
