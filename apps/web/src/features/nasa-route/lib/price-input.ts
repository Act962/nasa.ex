/**
 * Helpers para campos de preço em BRL com input localizado (pt-BR).
 *
 * Motivação: `<input type="number">` em locales pt-BR rejeita vírgula como
 * separador decimal em vários browsers, e `Number("1,99")` devolve NaN —
 * fazendo o form silenciosamente zerar o valor. Aqui usamos `type="text"`
 * com `inputMode="decimal"` e parseamos vírgula e ponto na submissão.
 */

/**
 * Converte o texto digitado pelo criador em centavos (inteiro).
 *
 * Aceita os formatos:
 *   "1,99"      → 199
 *   "1.99"      → 199
 *   "300,50"    → 30050
 *   "1300"      → 130000
 *   "1.300,50"  → 130050   (BR: ponto = milhar, vírgula = decimal)
 *   "1,300.50"  → 130050   (US: vírgula = milhar, ponto = decimal)
 *   ""          → 0
 *
 * Valores inválidos viram 0 — o caller decide se isso é erro
 * (ex.: validação de "preço mínimo R$ 0,50").
 */
export function parseBrlInputToCents(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/\s/g, "").trim();
  if (!cleaned) return 0;

  let normalized = cleaned;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // Tem os dois: o ÚLTIMO é o separador decimal, o outro vira milhar.
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  const n = Number(normalized);
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/**
 * Formata centavos pra exibir no input no formato pt-BR ("49,90").
 * Usado como valor inicial dos forms de criar/editar produto e plano.
 */
export function centsToBrlInput(cents: number | null | undefined): string {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
