import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { findGlossaryTerm, searchGlossary, type GlossaryTerm } from "@/features/accounting/lib/glossary/terms";
import { assertAccountingReadAccess } from "./access";

const MAX_MATCHES = 5;

function toTermPayload(glossaryTerm: GlossaryTerm) {
  return {
    id: glossaryTerm.id,
    label: glossaryTerm.label,
    explanation: glossaryTerm.plainExplanation,
    example: glossaryTerm.example ?? null,
    legalBasis: glossaryTerm.legalBasis ?? null,
    officialLinks: glossaryTerm.links.map((link) => ({
      label: link.label,
      url: link.url,
      lastVerifiedAt: link.lastVerifiedAt,
      needsVerification: link.needsVerification ?? false,
    })),
  };
}

export function buildAccountingGlossaryTools(ctx: AgentContext) {
  return {
    explain_fiscal_term: tool({
      description:
        "GLOSSÁRIO FISCAL da aba Contábil: explica um termo técnico (DAS, RBT12, Fator R, alíquota efetiva, CBS, IBS, cClassTrib, split payment, CND, pró-labore, markup...) em linguagem de dono de empresa, com exemplo, BASE LEGAL e LINKS OFICIAIS. Use SEMPRE que o usuário perguntar 'o que é X', 'pra que serve X', 'o que significa' algo fiscal/contábil, ou quando você for citar um termo técnico na resposta. Aceita o id do termo (ex.: 'fator-r') ou texto livre (ex.: 'imposto seletivo'). Cite a base legal e o link oficial que ela devolve — nunca invente link.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Id do termo (ex.: 'rbt12', 'split-payment') ou texto livre do usuário."),
      }),
      execute: async ({ query }) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const exactTerm = findGlossaryTerm(query.trim().toLowerCase());
        if (exactTerm) return { found: true, term: toTermPayload(exactTerm), otherMatches: [] };

        const matches = searchGlossary(query).slice(0, MAX_MATCHES);
        if (matches.length === 0) {
          return {
            found: false,
            message:
              "Esse termo ainda não está no glossário da aba Contábil. Explique com cautela, sem citar alíquota ou artigo de lei de memória, e sugira confirmar com um contador.",
          };
        }
        const [bestMatch, ...otherMatches] = matches;
        return {
          found: true,
          term: toTermPayload(bestMatch),
          otherMatches: otherMatches.map((match) => ({ id: match.id, label: match.label })),
        };
      },
    }),
  };
}
