import { applyBps, formatBps, formatCentsBrl, ratioToBps } from "../format";
import type { CalculationResult, CalculationStep, CalculationWarning } from "../tax/types";

export interface MarkupInput {
  unitCostCents: number;
  taxRateBps: number;
  commissionBps: number;
  desiredMarginBps: number;
  /** Outras despesas variáveis (cartão, frete...) em bps do preço. */
  otherVariableBps?: number;
}

export interface MarkupOutput {
  priceCents: number;
  markupDivisorBps: number;
  taxCents: number;
  commissionCents: number;
  marginCents: number;
}

/** Preço = custo ÷ (1 − impostos − comissão − outras − margem). */
export function computeMarkupPrice(input: MarkupInput): CalculationResult<MarkupOutput> {
  const warnings: CalculationWarning[] = [];
  const otherVariableBps = input.otherVariableBps ?? 0;
  const deductionsBps = input.taxRateBps + input.commissionBps + otherVariableBps + input.desiredMarginBps;
  const markupDivisorBps = 10000 - deductionsBps;

  if (markupDivisorBps <= 0) {
    return {
      output: { priceCents: 0, markupDivisorBps, taxCents: 0, commissionCents: 0, marginCents: 0 },
      steps: [],
      warnings: [
        {
          code: "impossible_markup",
          message: "Impostos + comissão + margem somam 100% ou mais: não existe preço que feche a conta.",
        },
      ],
      sources: [],
    };
  }

  const priceCents = Math.round((input.unitCostCents * 10000) / markupDivisorBps);
  const taxCents = applyBps(priceCents, input.taxRateBps);
  const commissionCents = applyBps(priceCents, input.commissionBps);
  const marginCents = applyBps(priceCents, input.desiredMarginBps);

  if (input.taxRateBps === 0) {
    warnings.push({ code: "zero_tax", message: "Imposto zerado: o preço provavelmente está subestimado." });
  }

  const steps: CalculationStep[] = [
    {
      label: "Markup divisor",
      formula: `100% − (${formatBps(input.taxRateBps)} impostos + ${formatBps(input.commissionBps)} comissão + ${formatBps(otherVariableBps)} outras + ${formatBps(input.desiredMarginBps)} margem)`,
      value: formatBps(markupDivisorBps),
      termId: "markup-divisor",
    },
    {
      label: "Preço de venda",
      formula: `${formatCentsBrl(input.unitCostCents)} ÷ ${formatBps(markupDivisorBps)}`,
      value: formatCentsBrl(priceCents),
    },
    { label: "Imposto embutido", value: formatCentsBrl(taxCents) },
    { label: "Comissão", value: formatCentsBrl(commissionCents) },
    { label: "Margem líquida", value: formatCentsBrl(marginCents) },
  ];

  return {
    output: { priceCents, markupDivisorBps, taxCents, commissionCents, marginCents },
    steps,
    warnings,
    sources: [],
  };
}

export interface RealMarginInput {
  priceCents: number;
  unitCostCents: number;
  taxRateBps: number;
  commissionBps: number;
  otherVariableBps?: number;
}

export interface RealMarginOutput {
  netCents: number;
  marginBps: number;
}

/** Margem real de um preço já praticado. */
export function computeRealMargin(input: RealMarginInput): CalculationResult<RealMarginOutput> {
  const taxCents = applyBps(input.priceCents, input.taxRateBps);
  const commissionCents = applyBps(input.priceCents, input.commissionBps);
  const otherCents = applyBps(input.priceCents, input.otherVariableBps ?? 0);
  const netCents = input.priceCents - input.unitCostCents - taxCents - commissionCents - otherCents;
  const marginBps = ratioToBps(netCents, input.priceCents);
  return {
    output: { netCents, marginBps },
    steps: [
      { label: "Preço", value: formatCentsBrl(input.priceCents) },
      { label: "(−) Custo", value: formatCentsBrl(input.unitCostCents) },
      { label: `(−) Impostos ${formatBps(input.taxRateBps)}`, value: formatCentsBrl(taxCents) },
      { label: `(−) Comissão ${formatBps(input.commissionBps)}`, value: formatCentsBrl(commissionCents) },
      { label: "(−) Outras variáveis", value: formatCentsBrl(otherCents) },
      { label: "Sobra líquida", value: `${formatCentsBrl(netCents)} (${formatBps(marginBps)})`, termId: "margem-liquida" },
    ],
    warnings:
      netCents < 0
        ? [{ code: "negative_margin", message: "Este preço dá prejuízo depois dos impostos." }]
        : [],
    sources: [],
  };
}
