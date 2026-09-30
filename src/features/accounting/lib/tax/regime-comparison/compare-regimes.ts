import { applyBps, formatBps, formatCentsBrl, ratioToBps } from "../../format";
import { selectSingleRate } from "../rate-lookup";
import { computeDas, type SimplesAnnex } from "../simples/compute-das";
import { computeIrpjCsllPresumido, computeMonthlyContributions } from "../presumido/compute-presumido";
import type { CalculationResult, CalculationStep, TaxRateRow, TaxRegimeCode } from "../types";

export interface CompareRegimesInput {
  annualRevenueCents: number;
  annualPayrollCents: number;
  simplesAnnex: SimplesAnnex;
  isFatorRSubject: boolean;
  issRateBps: number;
  /** Lucro Real: margem de lucro antes dos impostos sobre a receita. */
  profitMarginBps: number;
  /** Lucro Real: parcela da receita gasta com insumos que geram crédito de PIS/COFINS. */
  creditableCostsBps: number;
  /** Encargo patronal sobre a folha fora do Simples (20% + RAT + terceiros). */
  patronalChargesBps: number;
  rates: TaxRateRow[];
  at: Date;
}

export interface RegimeScenario {
  regime: TaxRegimeCode;
  totalCents: number;
  effectiveRateBps: number;
  isEligible: boolean;
  note: string | null;
}

const SIMPLES_CEILING_CENTS = 480_000_000;
const PRESUMIDO_CEILING_CENTS = 7_800_000_000;
const ANNUAL_ADDITIONAL_THRESHOLD_CENTS = 24_000_000;

export function compareRegimes(input: CompareRegimesInput): CalculationResult<{ scenarios: RegimeScenario[]; cheapest: TaxRegimeCode | null }> {
  const steps: CalculationStep[] = [];
  const scenarios: RegimeScenario[] = [];
  const quarterRevenueCents = Math.round(input.annualRevenueCents / 4);
  const monthRevenueCents = Math.round(input.annualRevenueCents / 12);
  const patronalCents = applyBps(input.annualPayrollCents, input.patronalChargesBps);

  // Simples
  const das = computeDas({
    rbt12Cents: input.annualRevenueCents,
    monthRevenueByAnnex: { [input.simplesAnnex]: input.annualRevenueCents },
    payroll12mCents: input.annualPayrollCents,
    isFatorRSubject: input.isFatorRSubject,
    rates: input.rates,
    at: input.at,
  });
  const appliedAnnex = das.output.lines[0]?.appliedAnnex ?? input.simplesAnnex;
  const simplesPatronalCents = appliedAnnex === "IV" ? patronalCents : 0;
  const simplesTotalCents = das.output.totalAmountCents + simplesPatronalCents;
  scenarios.push({
    regime: "SIMPLES",
    totalCents: simplesTotalCents,
    effectiveRateBps: ratioToBps(simplesTotalCents, input.annualRevenueCents),
    isEligible: input.annualRevenueCents <= SIMPLES_CEILING_CENTS,
    note: appliedAnnex === "IV" ? "Anexo IV paga a cota patronal (CPP) por fora." : `Anexo ${appliedAnnex}; CPP dentro do DAS.`,
  });

  // Presumido
  const irpjCsll = computeIrpjCsllPresumido({
    quarterRevenueCents,
    irpjBaseBps: 3200,
    csllBaseBps: 3200,
    rates: input.rates,
    at: input.at,
  });
  const monthly = computeMonthlyContributions({
    monthRevenueCents,
    pisCofinsRegime: "CUMULATIVO",
    issRateBps: input.issRateBps,
    rates: input.rates,
    at: input.at,
  });
  const presumidoTotalCents = irpjCsll.output.totalCents * 4 + monthly.output.totalCents * 12 + patronalCents;
  scenarios.push({
    regime: "PRESUMIDO",
    totalCents: presumidoTotalCents,
    effectiveRateBps: ratioToBps(presumidoTotalCents, input.annualRevenueCents),
    isEligible: input.annualRevenueCents <= PRESUMIDO_CEILING_CENTS,
    note: "Presunção de 32% (serviços). Inclui encargos patronais da folha.",
  });

  // Real (estimativa)
  const profitCents = applyBps(input.annualRevenueCents, input.profitMarginBps);
  const irpjRow = selectSingleRate(input.rates, { tax: "IRPJ", regime: "PRESUMIDO", annex: "ALIQUOTA", at: input.at });
  const csllRow = selectSingleRate(input.rates, { tax: "CSLL", regime: "PRESUMIDO", annex: "ALIQUOTA", at: input.at });
  const irpjCents = applyBps(profitCents, irpjRow?.rateBps ?? 1500) +
    applyBps(Math.max(0, profitCents - ANNUAL_ADDITIONAL_THRESHOLD_CENTS), 1000);
  const csllCents = applyBps(profitCents, csllRow?.rateBps ?? 900);
  const pisRow = selectSingleRate(input.rates, { tax: "PIS", annex: "NAO_CUMULATIVO", at: input.at });
  const cofinsRow = selectSingleRate(input.rates, { tax: "COFINS", annex: "NAO_CUMULATIVO", at: input.at });
  const pisCofinsBps = (pisRow?.rateBps ?? 0) + (cofinsRow?.rateBps ?? 0);
  const pisCofinsNetBase = input.annualRevenueCents - applyBps(input.annualRevenueCents, input.creditableCostsBps);
  const pisCofinsCents = applyBps(pisCofinsNetBase, pisCofinsBps);
  const issCents = applyBps(input.annualRevenueCents, input.issRateBps);
  const realTotalCents = irpjCents + csllCents + pisCofinsCents + issCents + patronalCents;
  scenarios.push({
    regime: "REAL",
    totalCents: realTotalCents,
    effectiveRateBps: ratioToBps(realTotalCents, input.annualRevenueCents),
    isEligible: true,
    note: `Estimativa com margem de ${formatBps(input.profitMarginBps)} e ${formatBps(input.creditableCostsBps)} de custos com crédito.`,
  });

  for (const scenario of scenarios) {
    steps.push({
      label: `${scenario.regime === "SIMPLES" ? "Simples Nacional" : scenario.regime === "PRESUMIDO" ? "Lucro Presumido" : "Lucro Real"}${scenario.isEligible ? "" : " (não elegível)"}`,
      formula: scenario.note ?? undefined,
      value: `${formatCentsBrl(scenario.totalCents)} / ano (${formatBps(scenario.effectiveRateBps)})`,
      termId: scenario.regime === "SIMPLES" ? "simples-nacional" : scenario.regime === "PRESUMIDO" ? "lucro-presumido" : "lucro-real",
    });
  }

  const eligible = scenarios.filter((scenario) => scenario.isEligible);
  const cheapest = eligible.length > 0
    ? eligible.reduce((best, scenario) => (scenario.totalCents < best.totalCents ? scenario : best)).regime
    : null;

  return {
    output: { scenarios, cheapest },
    steps,
    warnings: [
      {
        code: "estimate_only",
        message: "Comparativo simplificado para decisão. A troca de regime vale só para o ano seguinte (opção em janeiro).",
      },
    ],
    sources: [...das.sources, ...irpjCsll.sources, ...monthly.sources],
  };
}
