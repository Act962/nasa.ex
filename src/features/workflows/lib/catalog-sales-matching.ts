// Funções puras das ações da venda guiada (spec 0104), cobertas por scripts/catalog-quote-qa-check.ts.
import { isValidCpf } from "@/features/form/lib/masks";

export function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const checkDigit = (base: string, weights: number[]) => {
    const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = checkDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[12]) && second === Number(digits[13]);
}

export function extractDocument(text: string): string | null {
  const candidates = text.match(/\d[\d.\-/\s]{9,20}\d/g) ?? [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length === 11 && isValidCpf(digits)) return digits;
    if (digits.length === 14 && isValidCnpj(digits)) return digits;
  }
  return null;
}

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Consultor citado no texto: nome completo ou primeiro nome como palavra inteira. */
export function matchConsultants<T extends { name: string }>(text: string, consultants: T[]): T[] {
  const words = new Set(normalizeName(text).split(/[^a-z0-9]+/).filter(Boolean));
  const normalizedText = ` ${normalizeName(text).replace(/[^a-z0-9]+/g, " ")} `;
  const byFullName = consultants.filter((consultant) => normalizedText.includes(` ${normalizeName(consultant.name).replace(/[^a-z0-9]+/g, " ")} `));
  if (byFullName.length > 0) return byFullName;
  return consultants.filter((consultant) => {
    const firstName = normalizeName(consultant.name).split(/\s+/)[0];
    return !!firstName && firstName.length >= 3 && words.has(firstName);
  });
}

const AFFIRMATIVE_WORDS = new Set(["sim", "tenho", "ja", "eu", "uhum", "claro", "tem", "possuo"]);

/** "Tenho sim" (botão do template) ou "sim, tenho": disse que tem consultor, mas sem o nome. */
export function isAffirmativeWithoutName(text: string): boolean {
  const words = normalizeName(text).split(/[^a-z0-9]+/).filter(Boolean);
  return words.length > 0 && words.every((word) => AFFIRMATIVE_WORDS.has(word)) && words.some((word) => word === "sim" || word === "tenho");
}
