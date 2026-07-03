// Máscara numérica pt-BR: vírgula é o separador decimal e o ponto é separador
// de milhar (descartado na digitação). Mantém no máximo 2 casas decimais para
// casar com as colunas `Decimal(15, 2)` do Prisma.

const NON_NUMERIC_CHARS_REGEX = /[^\d,]/g;
const MAX_DECIMAL_PLACES = 2;

export function maskNumber(rawValue: string): string {
  const digitsAndComma = rawValue
    .replace(/\./g, "")
    .replace(NON_NUMERIC_CHARS_REGEX, "");
  const hasDecimalSeparator = digitsAndComma.includes(",");
  const [integerDigits, ...decimalGroups] = digitsAndComma.split(",");

  if (!hasDecimalSeparator) return integerDigits;

  const decimalDigits = decimalGroups.join("").slice(0, MAX_DECIMAL_PLACES);
  return `${integerDigits},${decimalDigits}`;
}

// Converte a string mascarada (pt-BR) para o formato que o backend/Decimal
// espera: ponto como separador decimal, sem separador pendente e sem valores
// vazios ou inválidos (que quebrariam o `Decimal` do Prisma em runtime).
export function sanitizeNumericString(
  rawValue: string | null | undefined,
): string {
  if (!rawValue) return "";
  const withDotDecimal = maskNumber(rawValue).replace(",", ".");
  const normalized = withDotDecimal.replace(/\.$/, "");
  if (!normalized || normalized === ".") return "";
  return normalized;
}

// Parseia a string mascarada pt-BR para número (cálculos de subtotal/total).
export function parseNumericString(
  rawValue: string | null | undefined,
): number {
  const parsed = Number(sanitizeNumericString(rawValue));
  return Number.isFinite(parsed) ? parsed : 0;
}

// Converte um valor vindo do backend (ponto decimal, ex.: "1500.00") para o
// formato de exibição pt-BR usado nos inputs (vírgula decimal).
export function formatNumericForInput(
  rawValue: string | null | undefined,
): string {
  if (rawValue === null || rawValue === undefined || rawValue === "") return "";
  return String(rawValue).replace(".", ",");
}
