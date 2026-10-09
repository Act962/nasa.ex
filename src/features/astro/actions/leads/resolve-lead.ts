import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroActionResult } from "../types";
import { parsePickedAnswer } from "@/features/astro/lib/astro-picker";

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

const SPOKEN_NAME_LEAD_IN = /^(?:(?:[eé]|eh)\s+)?(?:(?:com|para|pra|pro|do|da|de)\s+)?(?:(?:o|a|os|as)\s+)?/i;

export async function resolveSingleLead(params: {
  ctx: AgentContext;
  name: string;
  /** Campo a repetir na pergunta, para o ciclo guiado saber o que pedir. */
  field: string;
  appName: string;
  /** Texto extra quando há homônimo — exclusão usa para reforçar o risco. */
  ambiguityHint?: string;
}): Promise<LeadResolution> {
  // Escolhido na busca do cartão: vem com o id, e o id decide sozinho.
  const picked = parsePickedAnswer(params.name);
  const findLeads = (leadName: string) =>
    prisma.lead.findMany({
      where: {
        ...(picked.id ? { id: picked.id } : { name: { contains: leadName.replace(/_/g, " "), mode: "insensitive" } }),
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
  let candidates = await findLeads(picked.label);
  // "Com quem é o compromisso?" → "Com o Antônio José": a resposta natural traz a preposição.
  // Só tenta sem ela depois de não achar o nome como veio — um lead pode se chamar "A Casa do Pão".
  const nameWithoutLeadIn = picked.label.replace(SPOKEN_NAME_LEAD_IN, "").trim();
  if (candidates.length === 0 && !picked.id && nameWithoutLeadIn.length >= 2 && nameWithoutLeadIn !== picked.label) {
    candidates = await findLeads(nameWithoutLeadIn);
  }

  if (candidates.length === 0) {
    return {
      failure: {
        status: "needs_input",
        title: "Lead não encontrado",
        description: `Não achei nenhum lead com "${picked.label}". Busque abaixo.`,
        missingFields: [{ key: params.field, label: "nome do lead" }],
        appName: params.appName,
        picker: { kind: "entity", entity: "lead", placeholder: "Buscar lead por nome ou telefone" },
      },
    };
  }

  if (candidates.length > 1) {
    return {
      failure: {
        status: "ambiguous",
        title: "Mais de um lead com esse nome",
        description:
          `Achei ${candidates.length} leads parecidos com "${picked.label}".` +
          (params.ambiguityHint ? ` ${params.ambiguityHint}` : " Qual deles?"),
        field: params.field,
        options: candidates.map((lead) => ({
          id: lead.id,
          label: `${lead.name} — ${lead.tracking.name}`,
        })),
        appName: params.appName,
        picker: { kind: "entity", entity: "lead", placeholder: "Buscar lead por nome ou telefone" },
      },
    };
  }

  return { lead: candidates[0] };
}
