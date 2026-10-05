import "server-only";
import { ORPCError } from "@orpc/server";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { assertPlannerOrganizationAccess } from "@/features/nasa-planner/server/cross-org";

/** Empresa alvo das tools do Planner: a travada pelo WhatsApp, a informada ou a ativa — sempre com a permissão do Planner. */
export async function resolvePlannerOrganization(
  ctx: AgentContext,
  organizationId: string | undefined,
  action: "view" | "create" | "schedule",
): Promise<{ organizationId: string } | { error: string }> {
  const preferredOrganizationId = ctx.restrictToOrgId ?? organizationId ?? ctx.organizationId;
  // O modelo às vezes inventa o ID (ou manda o nome da empresa): se não for uma empresa acessível, vale a atual.
  const candidates = [...new Set([preferredOrganizationId, ctx.restrictToOrgId ?? ctx.organizationId])];
  let lastError = "Sem acesso ao Planner desta empresa.";
  for (const candidateOrganizationId of candidates) {
    try {
      await assertPlannerOrganizationAccess(ctx.userId, candidateOrganizationId, action);
      return { organizationId: candidateOrganizationId };
    } catch (error) {
      if (error instanceof ORPCError) lastError = error.message;
    }
  }
  return { error: lastError };
}

export function toToolError(error: unknown) {
  return { error: error instanceof Error ? error.message : String(error) };
}
