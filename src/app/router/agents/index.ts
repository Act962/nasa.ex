import { listAgents } from "./list";
import { createAgent } from "./create";
import { updateAgent } from "./update";
import { deleteAgent } from "./delete";
import { startSessionForLead } from "./start-for-lead";

/**
 * NASA Auto Agent — agentes IA orientados a objetivos.
 *
 * Fase 1: CRUD básico + start-for-lead (cria session ACTIVE).
 * Fase 2: tools novos + Inngest scheduler.
 * Fase 3: UI completa (criar agente em linguagem natural).
 * Fase 4: presets + métricas + loop detection.
 */
export const agentsRouter = {
  list: listAgents,
  create: createAgent,
  update: updateAgent,
  delete: deleteAgent,
  startSession: startSessionForLead,
};
