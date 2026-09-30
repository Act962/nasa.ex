import { formatCentsBrl } from "../../format";
import { describeSource, selectSingleRate } from "../rate-lookup";
import type { CalculationResult, TaxRateRow } from "../types";

export const MEI_ACTIVITIES = ["COMERCIO_INDUSTRIA", "SERVICOS", "COMERCIO_SERVICOS"] as const;
export type MeiActivity = (typeof MEI_ACTIVITIES)[number];

const MEI_ANNUAL_LIMIT_CENTS = 8_100_000;

export interface ComputeDasMeiInput {
  activity: MeiActivity;
  /** Receita acumulada no ano, para o alerta de desenquadramento. */
  yearRevenueCents: number;
  rates: TaxRateRow[];
  at: Date;
}

export interface ComputeDasMeiOutput {
  amountCents: number;
}

export function computeDasMei(input: ComputeDasMeiInput): CalculationResult<ComputeDasMeiOutput> {
  const row = selectSingleRate(input.rates, {
    tax: "DAS_MEI",
    regime: "MEI",
    annex: input.activity,
    at: input.at,
  });

  if (!row || row.fixedAmountCents === null) {
    return {
      output: { amountCents: 0 },
      steps: [],
      warnings: [{ code: "missing_table", message: "Valor do DAS-MEI não cadastrado para este ano." }],
      sources: [],
    };
  }

  const warnings =
    input.yearRevenueCents > MEI_ANNUAL_LIMIT_CENTS
      ? [
          {
            code: "above_mei_limit",
            message:
              input.yearRevenueCents > Math.round(MEI_ANNUAL_LIMIT_CENTS * 1.2)
                ? "Receita acima de 20% do limite do MEI: o desenquadramento retroage a janeiro."
                : "Receita acima de R$ 81 mil: o MEI passa ao Simples no ano seguinte e paga DAS complementar sobre o excesso.",
          },
        ]
      : [];

  return {
    output: { amountCents: row.fixedAmountCents },
    steps: [
      {
        label: "DAS-MEI (valor fixo mensal)",
        formula: row.note ?? undefined,
        value: formatCentsBrl(row.fixedAmountCents),
        legalSource: row.legalSource,
        termId: "das-mei",
      },
    ],
    warnings,
    sources: [describeSource(row)],
  };
}
