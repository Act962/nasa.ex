/**
 * Converte o valor do OFX para centavos inteiros.
 *
 * Por string, e não por `Math.round(parseFloat(x) * 100)`: em ponto flutuante
 * `parseFloat("1234.56") * 100` dá 123455.99999999999, e centavos somem em
 * valores grandes. Aqui nenhum dígito passa por float.
 */

const AMOUNT_PATTERN = /^([+-]?)(\d+)(?:[.,](\d+))?$/;

export function parseOfxAmountToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "");
  if (!cleaned) return null;

  // Separador de milhar aparece em alguns bancos: "1.234,56" ou "1,234.56".
  // O último separador é o decimal; os anteriores são ruído.
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);
  const normalized =
    decimalAt === -1
      ? cleaned
      : cleaned.slice(0, decimalAt).replace(/[.,]/g, "") +
        "." +
        cleaned.slice(decimalAt + 1);

  const match = AMOUNT_PATTERN.exec(normalized);
  if (!match) return null;

  const [, sign, whole, fraction = ""] = match;
  const cents = `${fraction}00`.slice(0, 2);
  const value = Number(whole) * 100 + Number(cents);
  return sign === "-" ? -value : value;
}
