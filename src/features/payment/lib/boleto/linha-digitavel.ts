// Linha digitável de boleto brasileiro: validação determinística e leitura do
// valor e do vencimento. Serve para conferir o que o modelo extraiu do PDF —
// dígito errado rebaixa a confiança da leitura (spec 0014, RF-8).
//
// Dois layouts (FEBRABAN):
//   - Cobrança (47 dígitos): 5 campos; DV mod10 nos campos 1–3; fator de
//     vencimento + valor no campo 5.
//   - Arrecadação/convênio (48 dígitos, começa com 8): 4 blocos de 11 + DV;
//     DV mod10 ou mod11 conforme o 3º dígito; valor nas posições 5–15.

export interface ParsedLinhaDigitavel {
  layout: "COBRANCA" | "ARRECADACAO";
  digits: string;
  isValid: boolean;
  amountCents: number | null;
  dueDate: Date | null;
  bankCode: string | null;
  warnings: string[];
}

/** Base do fator de vencimento (FEBRABAN). */
const FACTOR_EPOCH_UTC = Date.UTC(1997, 9, 7);
/** Em 22/02/2025 o fator voltou a 1000 — datas após isso somam 9000 dias. */
const FACTOR_RESET_UTC = Date.UTC(2025, 1, 22);
const DAY_MS = 24 * 60 * 60 * 1000;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function mod10CheckDigit(block: string): number {
  let sum = 0;
  let weight = 2;
  for (let index = block.length - 1; index >= 0; index -= 1) {
    let product = Number(block[index]) * weight;
    if (product > 9) product = Math.floor(product / 10) + (product % 10);
    sum += product;
    weight = weight === 2 ? 1 : 2;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/** Mod11 de arrecadação: pesos 2..9, DV 0 quando resto é 0 ou 1. */
export function mod11ArrecadacaoCheckDigit(block: string): number {
  let sum = 0;
  let weight = 2;
  for (let index = block.length - 1; index >= 0; index -= 1) {
    sum += Number(block[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return 0;
  return 11 - remainder;
}

/** Mod11 do DV geral do código de barras de cobrança: DV 1 quando resto dá 0, 10 ou 11. */
export function mod11CobrancaCheckDigit(block: string): number {
  let sum = 0;
  let weight = 2;
  for (let index = block.length - 1; index >= 0; index -= 1) {
    sum += Number(block[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const digit = 11 - remainder;
  return digit === 0 || digit === 10 || digit === 11 ? 1 : digit;
}

/**
 * O fator tem 4 dígitos e reiniciou em 1000 no dia 22/02/2025 — o mesmo
 * número vale para duas datas (ciclo antigo e novo). Fica com a mais próxima
 * de hoje, que é a única leitura que faz sentido para um boleto em mãos.
 */
export function dueDateFromFactor(factor: number): Date | null {
  if (!Number.isFinite(factor) || factor <= 0) return null;
  const oldCycle = FACTOR_EPOCH_UTC + factor * DAY_MS;
  const newCycle = FACTOR_RESET_UTC + (factor - 1000) * DAY_MS;
  const now = Date.now();
  const closest =
    Math.abs(newCycle - now) < Math.abs(oldCycle - now) ? newCycle : oldCycle;
  return new Date(closest);
}

function parseCobranca(digits: string): ParsedLinhaDigitavel {
  const warnings: string[] = [];
  const field1 = digits.slice(0, 9);
  const dv1 = Number(digits[9]);
  const field2 = digits.slice(10, 20);
  const dv2 = Number(digits[20]);
  const field3 = digits.slice(21, 31);
  const dv3 = Number(digits[31]);
  const generalDv = Number(digits[32]);
  const factor = Number(digits.slice(33, 37));
  const amountCents = Number(digits.slice(37, 47));

  if (mod10CheckDigit(field1) !== dv1) warnings.push("Dígito verificador do campo 1 inválido");
  if (mod10CheckDigit(field2) !== dv2) warnings.push("Dígito verificador do campo 2 inválido");
  if (mod10CheckDigit(field3) !== dv3) warnings.push("Dígito verificador do campo 3 inválido");

  // Reconstrói o código de barras para conferir o DV geral.
  const barcodeWithoutDv =
    field1.slice(0, 4) + digits.slice(33, 47) + field1.slice(4, 9) + field2 + field3;
  if (mod11CobrancaCheckDigit(barcodeWithoutDv) !== generalDv) {
    warnings.push("Dígito verificador geral do código de barras inválido");
  }

  return {
    layout: "COBRANCA",
    digits,
    isValid: warnings.length === 0,
    amountCents: amountCents > 0 ? amountCents : null,
    dueDate: dueDateFromFactor(factor),
    bankCode: digits.slice(0, 3),
    warnings,
  };
}

function parseArrecadacao(digits: string): ParsedLinhaDigitavel {
  const warnings: string[] = [];
  const blocks = [0, 12, 24, 36].map((start) => ({
    value: digits.slice(start, start + 11),
    dv: Number(digits[start + 11]),
  }));
  const valueIndicator = digits[2];
  const usesMod10 = valueIndicator === "6" || valueIndicator === "7";
  const usesMod11 = valueIndicator === "8" || valueIndicator === "9";

  if (!usesMod10 && !usesMod11) {
    warnings.push("Indicador de valor desconhecido na linha de arrecadação");
  } else {
    blocks.forEach((block, index) => {
      const expected = usesMod10
        ? mod10CheckDigit(block.value)
        : mod11ArrecadacaoCheckDigit(block.value);
      if (expected !== block.dv) {
        warnings.push(`Dígito verificador do bloco ${index + 1} inválido`);
      }
    });
  }

  const barcode = blocks.map((block) => block.value).join("");
  const hasRealValue = valueIndicator === "6" || valueIndicator === "8";
  const amountCents = hasRealValue ? Number(barcode.slice(4, 15)) : null;

  return {
    layout: "ARRECADACAO",
    digits,
    isValid: warnings.length === 0,
    amountCents: amountCents && amountCents > 0 ? amountCents : null,
    dueDate: null,
    bankCode: null,
    warnings,
  };
}

export function parseLinhaDigitavel(input: string): ParsedLinhaDigitavel | null {
  const digits = onlyDigits(input);
  if (digits.length === 47) return parseCobranca(digits);
  if (digits.length === 48 && digits.startsWith("8")) return parseArrecadacao(digits);
  return null;
}
