import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type {
  AstroConfirmationLine,
  AstroConfirmationResultPayload,
} from "@/features/astro/lib/astro-confirmation";

/**
 * Registro de executores de proposta. Cada domínio registra os seus
 * (`payment.entry.create`, ...) e `confirm_action` resolve por `actionType`.
 * O payload é o que a tool `propose_*` gravou — o executor confia nele porque
 * a validação aconteceu na proposta, com o mesmo `ctx`.
 */

export interface ProposalExecutionResult {
  ok: boolean;
  summary: string;
  lines?: AstroConfirmationLine[];
  links?: AstroConfirmationResultPayload["links"];
  /** Dados extras guardados em `AstroPendingAction.result` (ids criados, etc). */
  data?: Record<string, unknown>;
}

export type ProposalExecutor<Payload = Record<string, unknown>> = (params: {
  ctx: AgentContext;
  proposalId: string;
  payload: Payload;
}) => Promise<ProposalExecutionResult>;

const executors = new Map<string, ProposalExecutor>();

export function registerProposalExecutor<Payload>(
  actionType: string,
  executor: ProposalExecutor<Payload>,
) {
  executors.set(actionType, executor as ProposalExecutor);
}

export function getProposalExecutor(actionType: string): ProposalExecutor | undefined {
  return executors.get(actionType);
}
