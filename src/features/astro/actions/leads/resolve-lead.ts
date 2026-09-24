import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroActionResult } from "../types";

// Resolver lead por nome é o começo de quase todo verbo de tracking, e a
// regra é sempre a mesma: nada encontrado vira pergunta, homônimo vira
// escolha do usuário. Estava copiada em cada ação — aqui vira uma só.

const MAX_CANDIDATES = 5;

export interface ResolvedLead {
  id: string;
  name: string;
  trackingId: string;
  tracking: { name: string; organizationId: string };
}

export type LeadResolution =
  | { lead: ResolvedLead }
  | { failure: AstroActionResult };

export async function resolveSingleLead(params: {
  ctx: AgentContext;
  name: string;
  /** Campo a repetir na pergunta, para o ciclo guiado saber o que pedir. */
  field: string;
  appName: string;
  /** Texto extra quando há homônimo — exclusão usa para reforçar o risco. */
  ambiguityHint?: string;
}): Promise<LeadResolution> {
  const candidates = await prisma.lead.findMany({
    where: {
      name: { contains: params.name.replace(/_/g, " "), mode: "insensitive" },
      tracking: { organizationId: params.ctx.organizationId },
    },
    select: {
      id: true,
      name: true,
      trackingId: true,
      tracking: { select: { name: true, organizationId: true } },
    },
    take: MAX_CANDIDATES,
  });

  if (candidates.length === 0) {
    return {
      failure: {
        status: "needs_input",
        title: "Lead não encontrado",
        description: `Não achei nenhum lead com "${params.name}".`,
        missingFields: [{ key: params.field, label: "nome do lead" }],
        appName: params.appName,
      },
    };
  }

  if (candidates.length > 1) {
    return {
      failure: {
        status: "ambiguous",
        title: "Mais de um lead com esse nome",
        description:
          `Achei ${candidates.length} leads parecidos com "${params.name}".` +
          (params.ambiguityHint ? ` ${params.ambiguityHint}` : " Qual deles?"),
        field: params.field,
        options: candidates.map((lead) => ({
          id: lead.id,
          label: `${lead.name} — ${lead.tracking.name}`,
        })),
        appName: params.appName,
      },
    };
  }

  return { lead: candidates[0] };
}
