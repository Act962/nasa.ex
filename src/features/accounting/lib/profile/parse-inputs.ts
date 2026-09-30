// Conversões dos campos digitados (pt-BR) para centavos e bps, e o caminho de volta.

/** "12.345,67" | "12345.67" | "1234" → centavos. Vazio ou inválido → 0. */
export function parseBrlToCents(text: string): number {
  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const reais = Number(normalized);
  return Number.isFinite(reais) && reais > 0 ? Math.round(reais * 100) : 0;
}

/** "5" | "2,5" → bps (500, 250). Vazio → null. */
export function parsePercentToBps(text: string): number | null {
  const cleaned = text.replace(/[^\d,.]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const percent = Number(cleaned);
  return Number.isFinite(percent) && percent >= 0 ? Math.round(percent * 100) : null;
}

export function centsToInputText(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function bpsToInputText(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return "";
  return (bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
