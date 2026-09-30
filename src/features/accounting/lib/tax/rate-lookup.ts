import type { TaxKindCode, TaxRateRow, TaxRegimeCode } from "./types";

export interface RateFilter {
  tax: TaxKindCode;
  regime?: TaxRegimeCode | null;
  annex?: string | null;
  municipioIbge?: string | null;
  cClassTrib?: string | null;
  at: Date;
}

export function isRateValidAt(row: TaxRateRow, at: Date): boolean {
  if (row.validFrom.getTime() > at.getTime()) return false;
  if (row.validTo && row.validTo.getTime() < at.getTime()) return false;
  return true;
}

/**
 * Linhas vigentes na data. Quando há linha municipal para o município pedido,
 * ela vence a genérica — é assim que a alíquota de ISS da prefeitura
 * sobrescreve o padrão.
 */
export function selectRates(rows: TaxRateRow[], filter: RateFilter): TaxRateRow[] {
  const matching = rows.filter((row) => {
    if (row.tax !== filter.tax) return false;
    if (filter.regime !== undefined && row.regime !== null && row.regime !== filter.regime) {
      return false;
    }
    if (filter.annex !== undefined && (row.annex ?? null) !== (filter.annex ?? null)) {
      return false;
    }
    if (filter.cClassTrib !== undefined && row.cClassTrib !== null && row.cClassTrib !== filter.cClassTrib) {
      return false;
    }
    return isRateValidAt(row, filter.at);
  });

  if (filter.municipioIbge) {
    const municipal = matching.filter((row) => row.municipioIbge === filter.municipioIbge);
    if (municipal.length > 0) return municipal;
  }
  return matching.filter((row) => row.municipioIbge === null);
}

export function selectSingleRate(rows: TaxRateRow[], filter: RateFilter): TaxRateRow | null {
  const selected = selectRates(rows, filter);
  if (selected.length === 0) return null;
  // Vigência mais recente primeiro: dois registros sobrepostos resolvem pelo novo.
  return [...selected].sort((left, right) => right.validFrom.getTime() - left.validFrom.getTime())[0];
}

export function describeSource(row: TaxRateRow): string {
  const from = row.validFrom.toISOString().slice(0, 10);
  const to = row.validTo ? row.validTo.toISOString().slice(0, 10) : "atual";
  return `${row.legalSource} (vigência ${from} → ${to})`;
}
