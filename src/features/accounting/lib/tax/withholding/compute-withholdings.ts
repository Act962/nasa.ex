import { applyBps, formatBps, formatCentsBrl } from "../../format";
import { selectSingleRate } from "../rate-lookup";
import type { CalculationResult, CalculationStep, TaxRateRow } from "../types";

export interface WithholdingInput {
  invoiceCents: number;
  withholdIrrf: boolean;
  withholdCsrf: boolean;
  withholdInss: boolean;
  issWithheldRateBps: number;
  rates: TaxRateRow[];
  at: Date;
}

export interface WithholdingOutput {
  irrfCents: number;
  csrfCents: number;
  inssCents: number;
  issCents: number;
  totalWithheldCents: number;
  netReceivableCents: number;
}

// Retenção de IRRF abaixo de R$ 10,00 é dispensada (Lei 9.430/1996, art. 67).
const MINIMUM_WITHHOLDING_CENTS = 1_000;

export function computeWithholdings(input: WithholdingInput): CalculationResult<WithholdingOutput> {
  const steps: CalculationStep[] = [{ label: "Valor da nota", value: formatCentsBrl(input.invoiceCents) }];

  const irrfRow = selectSingleRate(input.rates, { tax: "IRRF", annex: "RETENCAO_SERVICOS", at: input.at });
  const csrfRow = selectSingleRate(input.rates, { tax: "PIS", annex: "CSRF", at: input.at });
  const inssRow = selectSingleRate(input.rates, { tax: "INSS", annex: "RETENCAO_CESSAO", at: input.at });

  let irrfCents = input.withholdIrrf && irrfRow ? applyBps(input.invoiceCents, irrfRow.rateBps) : 0;
  if (irrfCents > 0 && irrfCents < MINIMUM_WITHHOLDING_CENTS) irrfCents = 0;
  const csrfCents = input.withholdCsrf && csrfRow ? applyBps(input.invoiceCents, csrfRow.rateBps) : 0;
  const inssCents = input.withholdInss && inssRow ? applyBps(input.invoiceCents, inssRow.rateBps) : 0;
  const issCents = applyBps(input.invoiceCents, input.issWithheldRateBps);

  if (input.withholdIrrf && irrfRow) {
    steps.push({
      label: `IRRF ${formatBps(irrfRow.rateBps)}`,
      value: `− ${formatCentsBrl(irrfCents)}`,
      legalSource: irrfRow.legalSource,
      termId: "retencao-na-fonte",
    });
  }
  if (input.withholdCsrf && csrfRow) {
    steps.push({ label: `PIS/COFINS/CSLL ${formatBps(csrfRow.rateBps)}`, value: `− ${formatCentsBrl(csrfCents)}`, legalSource: csrfRow.legalSource });
  }
  if (input.withholdInss && inssRow) {
    steps.push({ label: `INSS ${formatBps(inssRow.rateBps)}`, value: `− ${formatCentsBrl(inssCents)}`, legalSource: inssRow.legalSource });
  }
  if (issCents > 0) {
    steps.push({ label: `ISS retido ${formatBps(input.issWithheldRateBps)}`, value: `− ${formatCentsBrl(issCents)}`, legalSource: "LC 116/2003, art. 6º" });
  }

  const totalWithheldCents = irrfCents + csrfCents + inssCents + issCents;
  const netReceivableCents = input.invoiceCents - totalWithheldCents;
  steps.push({ label: "Líquido a receber", value: formatCentsBrl(netReceivableCents) });

  return {
    output: { irrfCents, csrfCents, inssCents, issCents, totalWithheldCents, netReceivableCents },
    steps,
    warnings: [],
    sources: [],
  };
}
