import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { findProposal, normalizeText, type ProposalLookup } from "./proposal-shared";

/**
 * A proposta de que a conversa está falando (spec 0032, RF-6).
 *
 * "Adiciona o Setup nela", logo depois de criar, não nomeia proposta nenhuma.
 * Guardar a última proposta tocada por sessão resolve isso sem perguntar o
 * número de novo. Em memória, por processo, com validade curta — mesma escolha
 * do ciclo guiado (`guided-slots.ts`): perder isso num restart custa ao usuário
 * repetir o número, não custa dado errado.
 */

const CONTEXT_TTL_MS = 15 * 60_000;

interface LastProposal {
  number: number;
  expiresAt: number;
}

const globalForProposalContext = globalThis as unknown as {
  astroLastProposal?: Map<string, LastProposal>;
};
const lastProposals = (globalForProposalContext.astroLastProposal ??= new Map<string, LastProposal>());

/** "nela", "nessa proposta", "a última" — aponta para trás, não nomeia. */
const REFERS_TO_LAST =
  /^(nela|nele|nessa|nesse|nesta|neste|essa|esse|esta|este|a ultima|o ultimo|a mesma|a proposta|proposta|dela|dele|ai|isso)\b/;

export function rememberProposal(ctx: AgentContext, proposalNumber: number): void {
  if (!ctx.sessionId) return;
  lastProposals.set(ctx.sessionId, {
    number: proposalNumber,
    expiresAt: Date.now() + CONTEXT_TTL_MS,
  });
}

function readLastProposal(ctx: AgentContext): number | null {
  if (!ctx.sessionId) return null;
  const remembered = lastProposals.get(ctx.sessionId);
  if (!remembered) return null;
  if (remembered.expiresAt < Date.now()) {
    lastProposals.delete(ctx.sessionId);
    return null;
  }
  return remembered.number;
}

/**
 * Resolve a proposta pelo que o usuário disse: número, cliente ou referência
 * ao turno anterior. Quem chama recebe o mesmo `ProposalLookup` de sempre.
 */
export async function resolveProposalReference(params: {
  ctx: AgentContext;
  reference: string;
  field?: string;
}): Promise<ProposalLookup> {
  const reference = params.reference.trim();
  const pointsBack = reference === "" || REFERS_TO_LAST.test(normalizeText(reference));

  if (pointsBack) {
    const lastNumber = readLastProposal(params.ctx);
    if (lastNumber !== null) {
      const found = await findProposal({
        organizationId: params.ctx.organizationId,
        reference: `#${lastNumber}`,
        field: params.field,
      });
      if (found.kind === "found") return found;
    }
  }

  return findProposal({
    organizationId: params.ctx.organizationId,
    reference,
    field: params.field,
  });
}
