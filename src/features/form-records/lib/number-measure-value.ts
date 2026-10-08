import { CURRENCY_UNIT_ID, CUSTOM_UNIT_ID, findMeasureUnit, formatMeasure, parseDecimalInput, roundToDecimals } from "./measure-units";

// Valor do bloco "Número com medida" (spec 0075, RF-1).

export const NUMBER_MEASURE_KIND = "number-measure";
export const NUMBER_MEASURE_BLOCK_TYPE = "NumberMeasure";

export interface NumberMeasureMeta {
  kind: typeof NUMBER_MEASURE_KIND;
  version: 1;
  amount: number;
  /** Símbolo mostrado: o da unidade conhecida ou o texto digitado na personalizada. */
  unit: string;
  isCurrency: boolean;
}

/** Símbolo efetivo a partir da configuração do bloco. */
export function resolveUnitSymbol(unitId: string, customUnit: string | undefined): string {
  if (unitId === CUSTOM_UNIT_ID) return (customUnit ?? "").trim();
  return findMeasureUnit(unitId)?.symbol ?? unitId;
}

export function buildNumberMeasureValue(params: {
  rawText: string;
  unitId: string;
  customUnit?: string;
}): { value: string; meta?: Record<string, unknown> } {
  const amount = parseDecimalInput(params.rawText);
  if (amount === null) return { value: "" };
  const unit = findMeasureUnit(params.unitId);
  const rounded = roundToDecimals(amount, unit?.decimals ?? 2);
  const symbol = resolveUnitSymbol(params.unitId, params.customUnit);
  const meta: NumberMeasureMeta = {
    kind: NUMBER_MEASURE_KIND,
    version: 1,
    amount: rounded,
    unit: symbol,
    isCurrency: params.unitId === CURRENCY_UNIT_ID,
  };
  return {
    value: formatMeasure(rounded, unit ? unit.id : symbol),
    meta: meta as unknown as Record<string, unknown>,
  };
}

export function parseNumberMeasureMeta(meta: Record<string, unknown> | undefined): NumberMeasureMeta | null {
  if (!meta || meta.kind !== NUMBER_MEASURE_KIND || typeof meta.amount !== "number") return null;
  return meta as unknown as NumberMeasureMeta;
}
