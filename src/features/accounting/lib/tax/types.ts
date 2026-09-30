// Tipos compartilhados do motor fiscal. Dinheiro sempre em centavos (Int) e
// alíquota em pontos-base (1% = 100 bps), para nunca somar ponto flutuante.

export type TaxKindCode =
  | "DAS"
  | "DAS_MEI"
  | "IRPJ"
  | "CSLL"
  | "PIS"
  | "COFINS"
  | "ISS"
  | "ICMS"
  | "CBS"
  | "IBS"
  | "IS"
  | "INSS"
  | "FGTS"
  | "IRRF";

export type TaxRegimeCode = "MEI" | "SIMPLES" | "PRESUMIDO" | "REAL";

/** Linha de `TaxRate` já desacoplada do Prisma (datas como Date). */
export interface TaxRateRow {
  tax: TaxKindCode;
  regime: TaxRegimeCode | null;
  annex: string | null;
  bracket: number | null;
  revenueFromCents: number | null;
  revenueToCents: number | null;
  rateBps: number;
  deductionCents: number | null;
  fixedAmountCents: number | null;
  municipioIbge: string | null;
  cClassTrib: string | null;
  reductionBps: number | null;
  validFrom: Date;
  validTo: Date | null;
  legalSource: string;
  note: string | null;
}

/** Um passo da memória de cálculo mostrada ao usuário. */
export interface CalculationStep {
  label: string;
  formula?: string;
  value: string;
  legalSource?: string;
  termId?: string;
}

export interface CalculationWarning {
  code: string;
  message: string;
}

export interface CalculationResult<TOutput> {
  output: TOutput;
  steps: CalculationStep[];
  warnings: CalculationWarning[];
  /** Base legal e vigência das tabelas usadas. */
  sources: string[];
}
