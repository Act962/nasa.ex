import { formatMeasure } from "./measure-units";
import { parseItemListMeta } from "./item-list-value";
import { parseNumberMeasureMeta } from "./number-measure-value";
import type { ParsedResponse, RecordBlock } from "./response-values";

// Bloco "Cálculo" (spec 0075, RF-3): uma operação sobre outros campos da
// mesma ficha. Recalculado no servidor a cada gravação — o navegador só mostra.

export const CALCULATION_KIND = "calculation";
export const CALCULATION_BLOCK_TYPE = "Calculation";

export const CALCULATION_OPERATIONS = ["SUM", "SUBTRACT", "MULTIPLY", "DIVIDE"] as const;
export type CalculationOperation = (typeof CALCULATION_OPERATIONS)[number];

export interface CalculationMeta {
  kind: typeof CALCULATION_KIND;
  version: 1;
  amount: number;
  unit: string;
}

/** Número de um campo: medida, total de lista de itens, escala ou outro cálculo. */
export function readNumericValue(entry: ParsedResponse[string] | undefined): number | null {
  if (!entry) return null;
  const measure = parseNumberMeasureMeta(entry.meta);
  if (measure) return measure.amount;
  const itemList = parseItemListMeta(entry.meta);
  if (itemList) return itemList.usageTotalCents / 100;
  if (entry.meta?.kind === CALCULATION_KIND && typeof entry.meta.amount === "number") return entry.meta.amount;
  if (typeof entry.meta?.num === "number") return entry.meta.num;
  return null;
}

export function applyOperation(operation: CalculationOperation, operands: number[]): number | null {
  if (operands.length === 0) return null;
  const [first, ...rest] = operands;
  if (operation === "SUM") return operands.reduce((total, operand) => total + operand, 0);
  if (operation === "SUBTRACT") return rest.reduce((total, operand) => total - operand, first);
  if (operation === "MULTIPLY") return operands.reduce((total, operand) => total * operand, 1);
  if (rest.some((operand) => operand === 0)) return null;
  return rest.reduce((total, operand) => total / operand, first);
}

function readOperation(rawOperation: unknown): CalculationOperation {
  return CALCULATION_OPERATIONS.find((operation) => operation === rawOperation) ?? "SUM";
}

/**
 * Preenche os blocos de cálculo, na ordem em que aparecem no formulário — um
 * cálculo pode usar o resultado de outro que venha antes dele.
 */
export function computeCalculations(params: { blocks: RecordBlock[]; response: ParsedResponse }): ParsedResponse {
  const computed: ParsedResponse = { ...params.response };
  for (const block of params.blocks) {
    if (block.blockType !== CALCULATION_BLOCK_TYPE) continue;
    const sourceBlockIds = Array.isArray(block.attributes?.sourceBlockIds)
      ? block.attributes.sourceBlockIds.filter((sourceId): sourceId is string => typeof sourceId === "string")
      : [];
    const operands = sourceBlockIds
      .map((sourceId) => readNumericValue(computed[sourceId]))
      .filter((operand): operand is number => operand !== null);
    const amount = applyOperation(readOperation(block.attributes?.operation), operands);
    if (amount === null) {
      computed[block.id] = { value: "" };
      continue;
    }
    const unit = typeof block.attributes?.resultUnit === "string" ? block.attributes.resultUnit : "";
    const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
    const meta: CalculationMeta = { kind: CALCULATION_KIND, version: 1, amount: rounded, unit };
    computed[block.id] = {
      value: formatMeasure(rounded, unit),
      meta: meta as unknown as Record<string, unknown>,
    };
  }
  return computed;
}
