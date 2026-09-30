import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { formatBps, formatCentsBrl, parseMonthKey, shiftMonthKey } from "@/features/accounting/lib/format";
import { computeDas, SIMPLES_ANNEXES, type SimplesAnnex } from "@/features/accounting/lib/tax/simples/compute-das";
import { computeDasMei, MEI_ACTIVITIES, type MeiActivity } from "@/features/accounting/lib/tax/mei/compute-das-mei";
import { computeCbsIbs } from "@/features/accounting/lib/tax/reforma/compute-cbs-ibs";
import { REFORM_TIMELINE } from "@/features/accounting/lib/tax/reforma/reform-timeline";
import {
  CALCULATORS,
  runCalculator,
  type CalculatorContextDefaults,
  type CalculatorValues,
} from "@/features/accounting/lib/calculator/calculator-registry";
import { loadTaxRates } from "@/features/accounting/server/tax-rates/load-tax-rates";
import { loadRbt12, loadRevenueByMonth } from "@/features/accounting/server/revenue/load-revenue";
import { loadAvailableCredits } from "@/features/accounting/server/credits/load-available-credits";
import { assertAccountingReadAccess, ACCOUNTING_TAB_URL } from "./access";
import {
  currentMonthKey,
  loadExistingTaxProfile,
  PROFILE_MISSING_MESSAGE,
  toCalculationPayload,
  toMonthMiddle,
} from "./shared";

// Simulações sem gravar nada: mesmas fórmulas da aba (libs puras), com os
// números da empresa. Apurar de verdade continua sendo um clique do usuário.

const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .describe("Mês AAAA-MM. Default: mês atual.");

function describeCalculatorCatalog(): string {
  return CALCULATORS.map((calculator) => {
    const fieldList = calculator.fields
      .map((field) => {
        const unit = field.type === "money" ? "centavos" : field.type === "percent" ? "bps" : field.type;
        const options = field.options ? ` [${field.options.map((option) => option.value).join("|")}]` : "";
        return `${field.name}:${unit}${options}`;
      })
      .join(", ");
    return `• ${calculator.id} — ${calculator.title} (${fieldList})`;
  }).join("\n");
}

async function loadCalculatorDefaults(organizationId: string): Promise<Partial<CalculatorContextDefaults>> {
  const profile = await loadExistingTaxProfile(organizationId);
  if (!profile) return {};
  const rbt12 = await loadRbt12({ organizationId, periodMonth: currentMonthKey(), openedAt: profile.openedAt });
  const forgeSettings = await prisma.forgeSettings.findUnique({
    where: { organizationId },
    select: { commissionPercentage: true },
  });
  return {
    rbt12Cents: rbt12.rbt12Cents,
    payroll12mCents: profile.payroll12mCents,
    simplesAnnex: profile.simplesAnnex ?? "III",
    isFatorRSubject: profile.isFatorRSubject,
    issRateBps: profile.issRateBps ?? 500,
    regime: profile.regime,
    ibsCbsOutsideSimples: profile.ibsCbsOutsideSimples,
    commissionBps: Math.round(Number(forgeSettings?.commissionPercentage ?? 0) * 100),
  };
}

export function buildAccountingSimulationTools(ctx: AgentContext) {
  return {
    simulate_das: tool({
      description:
        "SIMULA o DAS do Simples Nacional (ou o DAS-MEI) de um mês SEM GRAVAR NADA: calcula o RBT12 (receita dos 12 meses anteriores), aplica o Fator R quando o perfil pede, acha a faixa do anexo, a alíquota efetiva e o valor da guia, com memória de cálculo passo a passo e base legal. Use para 'quanto vou pagar de DAS', 'e se eu faturar R$ X esse mês', 'qual minha alíquota efetiva', 'Fator R'. Receita do mês = a lançada no financeiro, ou `monthRevenueCents` para simular outro valor. Só funciona para MEI e Simples; para Presumido/Real use `run_calculator` (presumido_mensal / presumido_trimestre / comparativo_regimes).",
      inputSchema: z.object({
        month: monthKeySchema.optional(),
        monthRevenueCents: z.number().int().min(0).optional().describe("Receita do mês para simular, em centavos. Default: a receita lançada no financeiro."),
        annex: z.enum(SIMPLES_ANNEXES).optional().describe("Anexo do Simples para simular. Default: o do perfil."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const profile = await loadExistingTaxProfile(ctx.organizationId);
        if (!profile) return { error: PROFILE_MISSING_MESSAGE };

        const periodMonth = input.month ?? currentMonthKey();
        const rates = await loadTaxRates(ctx.organizationId);
        const at = toMonthMiddle(periodMonth);

        if (profile.regime === "MEI") {
          const { year } = parseMonthKey(periodMonth);
          const yearRevenue = await loadRevenueByMonth({ organizationId: ctx.organizationId, fromMonth: `${year}-01`, toMonth: periodMonth });
          const activity = MEI_ACTIVITIES.includes(profile.simplesAnnex as MeiActivity)
            ? (profile.simplesAnnex as MeiActivity)
            : "SERVICOS";
          const calculation = computeDasMei({
            activity,
            yearRevenueCents: Object.values(yearRevenue).reduce((total, cents) => total + cents, 0),
            rates,
            at,
          });
          return {
            regime: "MEI",
            month: periodMonth,
            amount: formatCentsBrl(calculation.output.amountCents),
            glossaryTermId: "das-mei",
            ...toCalculationPayload(calculation),
            isSimulation: true,
          };
        }

        if (profile.regime !== "SIMPLES") {
          return {
            error: `A empresa está no ${profile.regime === "PRESUMIDO" ? "Lucro Presumido" : "Lucro Real"}, que não paga DAS. Use run_calculator com presumido_mensal/presumido_trimestre, ou a apuração em ${ACCOUNTING_TAB_URL}&sub=assessments.`,
          };
        }

        const rbt12 = await loadRbt12({ organizationId: ctx.organizationId, periodMonth, openedAt: profile.openedAt });
        const annex: SimplesAnnex = input.annex ?? (SIMPLES_ANNEXES.includes(profile.simplesAnnex as SimplesAnnex) ? (profile.simplesAnnex as SimplesAnnex) : "III");
        const monthRevenueCents = input.monthRevenueCents ?? rbt12.monthRevenueCents;
        const calculation = computeDas({
          rbt12Cents: rbt12.rbt12Cents,
          monthRevenueByAnnex: { [annex]: monthRevenueCents },
          payroll12mCents: profile.payroll12mCents,
          isFatorRSubject: profile.isFatorRSubject,
          rates,
          at,
        });
        calculation.steps.unshift(...rbt12.steps);
        return {
          regime: "SIMPLES",
          month: periodMonth,
          annex,
          monthRevenue: formatCentsBrl(monthRevenueCents),
          isRevenueSimulated: input.monthRevenueCents !== undefined,
          rbt12: formatCentsBrl(rbt12.rbt12Cents),
          isRbt12Proportional: rbt12.isProportional,
          effectiveRate: formatBps(calculation.output.effectiveRateBps, 4),
          fatorR: calculation.output.fatorRBps !== null ? formatBps(calculation.output.fatorRBps) : null,
          amount: formatCentsBrl(calculation.output.totalAmountCents),
          glossaryTermIds: ["das", "rbt12", "aliquota-efetiva", "fator-r", "anexo-simples"],
          ...toCalculationPayload(calculation),
          isSimulation: true,
          url: `${ACCOUNTING_TAB_URL}&sub=assessments`,
        };
      },
    }),

    simulate_cbs_ibs: tool({
      description:
        "SIMULA a CBS e o IBS da Reforma Tributária (EC 132/2023, LC 214/2025) para um ano da transição (2026–2033), SEM GRAVAR: débito sobre a receita, menos os créditos das notas de entrada já disponíveis, considerando o regime (no Simples, IBS/CBS ficam dentro do DAS salvo opção por fora). Devolve alíquotas usadas, valores, avisos (ano-teste 2026, alíquota ESTIMADA que ainda será fixada pelo Senado) e o marco da Reforma daquele ano com o que muda e o que fazer. Use para 'quanto vou pagar de CBS/IBS', 'como a Reforma me afeta em 2027', 'vale optar por fora do Simples'. Receita default = receita dos últimos 12 meses do financeiro.",
      inputSchema: z.object({
        year: z.number().int().min(2026).max(2033).describe("Ano da simulação (2026 a 2033)."),
        revenueCents: z.number().int().min(0).optional().describe("Receita a simular, em centavos. Default: últimos 12 meses."),
        reductionBps: z.number().int().min(0).max(10000).optional().describe("Redução do regime diferenciado (cClassTrib), em bps: 3000, 6000 ou 10000."),
        ibsCbsOutsideSimples: z.boolean().optional().describe("Simular o Simples recolhendo IBS/CBS por fora. Default: o do perfil."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };
        const profile = await loadExistingTaxProfile(ctx.organizationId);
        if (!profile) return { error: PROFILE_MISSING_MESSAGE };

        const periodMonth = currentMonthKey();
        let revenueCents = input.revenueCents;
        if (revenueCents === undefined) {
          const revenueByMonth = await loadRevenueByMonth({
            organizationId: ctx.organizationId,
            fromMonth: shiftMonthKey(periodMonth, -12),
            toMonth: shiftMonthKey(periodMonth, -1),
          });
          revenueCents = Object.values(revenueByMonth).reduce((total, cents) => total + cents, 0);
        }
        const credits = await loadAvailableCredits({ organizationId: ctx.organizationId, upToMonth: periodMonth });
        const rates = await loadTaxRates(ctx.organizationId);
        const calculation = computeCbsIbs({
          revenueCents,
          reductionBps: input.reductionBps,
          cbsCreditsCents: credits.cbsCents,
          ibsCreditsCents: credits.ibsCents,
          regime: profile.regime,
          ibsCbsOutsideSimples: input.ibsCbsOutsideSimples ?? profile.ibsCbsOutsideSimples,
          rates,
          at: new Date(Date.UTC(input.year, 6, 1)),
        });
        const milestone = [...REFORM_TIMELINE].reverse().find((reformMilestone) => reformMilestone.year <= input.year) ?? null;
        return {
          year: input.year,
          regime: profile.regime,
          revenue: formatCentsBrl(revenueCents),
          isRevenueSimulated: input.revenueCents !== undefined,
          availableCredits: { cbs: formatCentsBrl(credits.cbsCents), ibs: formatCentsBrl(credits.ibsCents) },
          cbsRate: formatBps(calculation.output.cbsRateBps),
          ibsRate: formatBps(calculation.output.ibsRateBps),
          totalDue: formatCentsBrl(calculation.output.totalDueCents),
          isInformativeOnly: calculation.output.isInformativeOnly,
          isInsideDas: calculation.output.isInsideDas,
          glossaryTermIds: ["cbs", "ibs", "credito-nao-cumulativo", "simples-por-fora", "split-payment"],
          ...toCalculationPayload(calculation),
          reformMilestone: milestone
            ? {
                year: milestone.year,
                title: milestone.title,
                summary: milestone.summary,
                changes: milestone.changes,
                actionsForAll: milestone.actionsByRegime.TODOS ?? [],
                actionsForThisRegime: milestone.actionsByRegime[profile.regime] ?? [],
                legalSource: milestone.legalSource,
              }
            : null,
          isSimulation: true,
          url: `${ACCOUNTING_TAB_URL}&sub=reform`,
        };
      },
    }),

    run_calculator: tool({
      description: `CALCULADORAS da aba Contábil (as mesmas da tela, com memória de cálculo e base legal). Nada é gravado. Valores em dinheiro vão em CENTAVOS e percentuais em BPS (1% = 100). Campos não informados usam o perfil fiscal da empresa quando existir (RBT12, anexo, Fator R, ISS, regime, comissão). Ids válidos e campos:\n${describeCalculatorCatalog()}\nUse para 'preço de venda com markup', 'margem real', 'retenção na nota', 'pró-labore', 'custo de funcionário', 'guia em atraso (multa e juros)', 'depreciação', 'juros', 'comparar regimes', 'Fator R', 'Lucro Presumido'. Se faltar um dado essencial (ex.: custo do produto), pergunte antes.`,
      inputSchema: z.object({
        calculatorId: z.string().min(1).describe("Id da calculadora (ver lista na descrição)."),
        values: z
          .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
          .describe("Campos da calculadora: dinheiro em centavos, percentual em bps, datas AAAA-MM-DD."),
        referenceDate: z.string().optional().describe("Data de referência AAAA-MM-DD para a tabela vigente. Default: hoje."),
      }),
      execute: async (input) => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const calculator = CALCULATORS.find((candidate) => candidate.id === input.calculatorId);
        if (!calculator) {
          return { error: `Calculadora "${input.calculatorId}" não existe. Ids válidos: ${CALCULATORS.map((candidate) => candidate.id).join(", ")}.` };
        }

        const defaults = await loadCalculatorDefaults(ctx.organizationId);
        const values: CalculatorValues = {};
        for (const field of calculator.fields) {
          const informedValue = input.values[field.name];
          if (informedValue !== undefined) {
            values[field.name] = informedValue;
            continue;
          }
          const prefilledValue = field.prefillFrom ? defaults[field.prefillFrom] : undefined;
          values[field.name] = prefilledValue ?? field.defaultValue;
        }

        const rates = await loadTaxRates(ctx.organizationId);
        const at = input.referenceDate ? new Date(`${input.referenceDate.slice(0, 10)}T12:00:00Z`) : new Date();
        const calculation = runCalculator(calculator.id, values, { rates, at });
        if (!calculation) return { error: "Não consegui rodar essa calculadora." };
        return {
          calculatorId: calculator.id,
          title: calculator.title,
          valuesUsed: values,
          ...toCalculationPayload(calculation),
          url: `${ACCOUNTING_TAB_URL}&sub=calculator`,
        };
      },
    }),
  };
}
