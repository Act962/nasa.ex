import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroActionResult } from "../types";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";

const TRACKING_PICKER: AstroPicker = { kind: "entity", entity: "tracking", placeholder: "Buscar funil" };

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
  const picked = params.name ? parsePickedAnswer(params.name) : null;
  const candidates = await prisma.tracking.findMany({
    where: {
      organizationId: params.ctx.organizationId,
      ...(picked?.id
        ? { id: picked.id }
        : picked
          ? { name: { contains: picked.label.replace(/_/g, " "), mode: "insensitive" } }
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
          ? `Não achei nenhum funil com "${picked?.label ?? params.name}".`
          : "Você ainda não tem tracking nenhum nesta organização.",
        missingFields: [{ key: params.field, label: "nome do tracking" }],
        appName: "Tracking",
        picker: TRACKING_PICKER,
      },
    };
  }

  if (candidates.length > 1) {
    return {
      failure: {
        status: "ambiguous",
        title: "Em qual funil?",
        description: params.name
          ? `Achei ${candidates.length} funis parecidos com "${picked?.label ?? params.name}".`
          : "Em qual funil?",
        field: params.field,
        options: candidates.map((tracking) => ({
          id: tracking.id,
          label: tracking.name,
        })),
        appName: "Tracking",
        picker: TRACKING_PICKER,
      },
    };
  }

  return { tracking: candidates[0] };
}
