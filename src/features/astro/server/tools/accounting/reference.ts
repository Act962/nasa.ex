import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { REGIME_LABELS } from "@/features/accounting/lib/profile/tax-display";
import { REFORM_TIMELINE } from "@/features/accounting/lib/tax/reforma/reform-timeline";
import { TAX_RATE_SEED_KEYS_TO_VERIFY } from "@/features/accounting/lib/tax/seed/default-tax-rates";
import { OFFICIAL_LINKS } from "@/features/accounting/lib/glossary/terms";
import {
  ACCOUNTING_SECTION_IDS,
  ACCOUNTING_SECTIONS,
  buildAccountingSectionUrl,
} from "@/features/accounting/lib/accounting-sections";
import { loadTaxRates } from "@/features/accounting/server/tax-rates/load-tax-rates";
import { assertAccountingReadAccess } from "./access";
import { loadExistingTaxProfile } from "./shared";

// Referência da aba Contábil: Reforma, tabelas de alíquota e o mapa da tela.
// Nada aqui calcula — as simulações ficam em simulations.ts.

const MAX_RATE_ROWS = 60;
const TAX_KINDS = ["DAS", "DAS_MEI", "IRPJ", "CSLL", "PIS", "COFINS", "ISS", "ICMS", "CBS", "IBS", "IS", "INSS", "FGTS", "IRRF"] as const;

function toMilestonePayload(milestone: (typeof REFORM_TIMELINE)[number], regime: keyof typeof REGIME_LABELS | null) {
  return {
    year: milestone.year,
    title: milestone.title,
    summary: milestone.summary,
    changes: milestone.changes,
    actionsForAll: milestone.actionsByRegime.TODOS ?? [],
    actionsForThisCompany: regime ? milestone.actionsByRegime[regime] ?? [] : [],
    legalSource: milestone.legalSource,
  };
}

export function buildAccountingReferenceTools(ctx: AgentContext) {
  return {
    get_reform_timeline: tool({
      description:
        "LINHA DO TEMPO DA REFORMA TRIBUTÁRIA (EC 132/2023 e LC 214/2025), a mesma da subaba Contábil › Reforma: o que muda em cada ano de 2026 a 2033 (ano-teste de 2026, CBS plena e fim do PIS/COFINS em 2027, IBS substituindo ICMS/ISS de 2029 a 2032, modelo final em 2033) e O QUE A EMPRESA DEVE FAZER no regime dela. Traz a base legal e links oficiais. Use para 'o que muda com a reforma?', 'o que muda em 2027?', 'o que eu preciso fazer por causa da reforma?', 'quando acaba o PIS/COFINS/ICMS/ISS?'. Para VALORES (quanto vou pagar de CBS/IBS) use simulate_cbs_ibs.",
      inputSchema: z.object({
        year: z.number().int().min(2026).max(2033).optional().describe("Ano específico. Sem ano: a linha do tempo inteira."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const profile = await loadExistingTaxProfile(ctx.organizationId);
        const regime = profile?.regime ?? null;

        const milestones = input.year
          ? [[...REFORM_TIMELINE].reverse().find((milestone) => milestone.year <= (input.year ?? 0)) ?? REFORM_TIMELINE[0]]
          : REFORM_TIMELINE;
        return {
          regime: regime ? REGIME_LABELS[regime] : null,
          isRegimeKnown: regime !== null,
          milestones: milestones.map((milestone) => toMilestonePayload(milestone, regime)),
          warnings: [
            "2026 é ano-teste: CBS e IBS aparecem destacados na nota, mas não há pagamento efetivo.",
            "As alíquotas de 2027 em diante são ESTIMADAS — a alíquota de referência ainda será fixada pelo Senado.",
          ],
          officialLinks: [OFFICIAL_LINKS.lc214, OFFICIAL_LINKS.ec132, OFFICIAL_LINKS.reformaFazenda].map((link) => ({ label: link.label, url: link.url })),
          glossaryTermIds: ["cbs", "ibs", "is", "split-payment", "simples-por-fora", "cclasstrib"],
          url: buildAccountingSectionUrl("reform"),
        };
      },
    }),

    list_tax_rates: tool({
      description:
        "TABELAS DE ALÍQUOTAS VIGENTES usadas pela aba Contábil (as mesmas das calculadoras): faixas do Simples por anexo (alíquota nominal e parcela a deduzir), DAS-MEI, presunção do Lucro Presumido, PIS/COFINS, ISS do município, INSS, FGTS, IRRF, CBS/IBS por ano da Reforma — cada linha com BASE LEGAL e o aviso quando o valor ainda está A CONFIRMAR na fonte oficial ou é estimado. Use para 'qual a tabela do anexo III?', 'qual a alíquota de ISS?', 'qual a alíquota da CBS em 2027?', 'qual alíquota usar no preço?' (para o preço, combine com get_tax_profile, que dá a alíquota EFETIVA da empresa). Nunca cite alíquota que não veio daqui ou de outra tool.",
      inputSchema: z.object({
        tax: z.enum(TAX_KINDS).optional().describe("Tributo. Default: todos (resumido)."),
        annex: z.string().optional().describe("Anexo do Simples (I a V) ou agrupamento, quando tax = DAS."),
        referenceDate: z.string().optional().describe("Data AAAA-MM-DD para ver a tabela vigente naquela data. Default: hoje."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        // Garante o seed das tabelas globais antes de ler.
        await loadTaxRates(ctx.organizationId);
        const referenceDate = input.referenceDate ? new Date(`${input.referenceDate.slice(0, 10)}T12:00:00Z`) : new Date();
        const rows = await prisma.taxRate.findMany({
          where: {
            OR: [{ organizationId: null }, { organizationId: ctx.organizationId }],
            ...(input.tax ? { tax: input.tax } : {}),
            ...(input.annex ? { annex: input.annex } : {}),
            validFrom: { lte: referenceDate },
            AND: [{ OR: [{ validTo: null }, { validTo: { gte: referenceDate } }] }],
          },
          orderBy: [{ tax: "asc" }, { annex: "asc" }, { bracket: "asc" }],
          take: MAX_RATE_ROWS,
        });

        const rates = rows.map((row) => ({
          tax: row.tax,
          regime: row.regime,
          annex: row.annex,
          bracket: row.bracket,
          revenueUpTo: row.revenueToCents !== null ? formatCentsBrl(row.revenueToCents) : null,
          rate: formatBps(row.rateBps),
          deduction: row.deductionCents !== null ? formatCentsBrl(row.deductionCents) : null,
          fixedAmount: row.fixedAmountCents !== null ? formatCentsBrl(row.fixedAmountCents) : null,
          reduction: row.reductionBps !== null ? formatBps(row.reductionBps) : null,
          isCompanyOverride: row.organizationId !== null,
          validFrom: row.validFrom.toISOString().slice(0, 10),
          legalSource: row.legalSource,
          note: row.note,
          needsVerification: row.seedKey ? TAX_RATE_SEED_KEYS_TO_VERIFY.has(row.seedKey) : false,
          isEstimated: Boolean(row.note?.toLowerCase().includes("estimad")),
        }));
        return {
          referenceDate: referenceDate.toISOString().slice(0, 10),
          count: rates.length,
          isTruncated: rows.length === MAX_RATE_ROWS,
          rowsToConfirm: rates.filter((rate) => rate.needsVerification).length,
          rates,
          note: "Linha com needsVerification = valor ainda a confirmar na fonte oficial; avise o usuário. Alíquota nominal não é a efetiva do Simples: a efetiva vem de get_tax_profile ou simulate_das.",
          url: buildAccountingSectionUrl("calculator"),
        };
      },
    }),

    get_accounting_section_link: tool({
      description:
        "MAPA DA ABA CONTÁBIL: devolve o link direto da subaba certa (`/payment?tab=accounting&sub=<id>`) e para que ela serve, para você mandar o usuário ao lugar exato da tela. Subabas: overview (Visão geral), documents (N-Box · Documentos, certidões, cofre), profile (Perfil fiscal), assessments (Apurações e guias), credits (Créditos IBS/CBS), pricing (Produtos & Preços), calendar (Calendário fiscal), calculator (Calculadora), chart (Plano de contas), reports (Balancete e balanço), reform (Reforma Tributária). Use quando o usuário perguntar 'onde vejo X?', 'onde eu apuro?', 'onde anexo a certidão?', 'me leva para...', ou para fechar uma resposta que exige ação na tela. Sem `section`, devolve o mapa inteiro.",
      inputSchema: z.object({
        section: z.enum(ACCOUNTING_SECTION_IDS).optional().describe("Id da subaba."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const sections = input.section ? [ACCOUNTING_SECTIONS[input.section]] : Object.values(ACCOUNTING_SECTIONS);
        return {
          sections: sections.map((section) => ({
            id: section.id,
            label: section.label,
            purpose: section.purpose,
            url: buildAccountingSectionUrl(section.id),
          })),
        };
      },
    }),
  };
}
