import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroActionResult } from "../types";

// Resolver tracking por nome, com um atalho que o resolvedor de lead não tem:
// quando a organização só tem um tracking, não faz sentido perguntar qual.

const MAX_CANDIDATES = 5;

export interface ResolvedTracking {
  id: string;
  name: string;
}

export type TrackingResolution =
  | { tracking: ResolvedTracking }
  | { failure: AstroActionResult };

export async function resolveSingleTracking(params: {
  ctx: AgentContext;
  /** Ausente quando o usuário não disse qual — aí só resolve se houver um. */
  name?: string;
  field: string;
}): Promise<TrackingResolution> {
  const candidates = await prisma.tracking.findMany({
    where: {
      organizationId: params.ctx.organizationId,
      ...(params.name
        ? { name: { contains: params.name.replace(/_/g, " "), mode: "insensitive" } }
        : {}),
    },
    select: { id: true, name: true },
    take: MAX_CANDIDATES,
  });

  if (candidates.length === 0) {
    return {
      failure: {
        status: "needs_input",
        title: "Tracking não encontrado",
        description: params.name
          ? `Não achei nenhum tracking com "${params.name}".`
          : "Você ainda não tem tracking nenhum nesta organização.",
        missingFields: [{ key: params.field, label: "nome do tracking" }],
        appName: "Tracking",
      },
    };
  }

  if (candidates.length > 1) {
    return {
      failure: {
        status: "ambiguous",
        title: "Em qual tracking?",
        description: params.name
          ? `Achei ${candidates.length} trackings parecidos com "${params.name}".`
          : `Você tem ${candidates.length} trackings. Em qual deles?`,
        field: params.field,
        options: candidates.map((tracking) => ({
          id: tracking.id,
          label: tracking.name,
        })),
        appName: "Tracking",
      },
    };
  }

  return { tracking: candidates[0] };
}
