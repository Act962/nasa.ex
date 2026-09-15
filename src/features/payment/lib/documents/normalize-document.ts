// CPF/CNPJ: normalização e validação de dígito verificador. A extração por IA
// erra dígito com facilidade — documento inválido vira aviso, não vínculo.

export function documentDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function allSameDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const digits = documentDigits(value);
  if (!digits || digits.length !== 11 || allSameDigit(digits)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = documentDigits(value);
  if (!digits || digits.length !== 14 || allSameDigit(digits)) return false;
  const calc = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * weights[index]!;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

export function isValidBrazilianDocument(value: string | null | undefined): boolean {
  const digits = documentDigits(value);
  if (!digits) return false;
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
}

export function formatBrazilianDocument(value: string | null | undefined): string | null {
  const digits = documentDigits(value);
  if (!digits) return null;
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digits;
}

/** Nome sem acentos, minúsculo e sem sufixos societários — para comparar contatos. */
export function normalizeContactName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\.?a\.?|sa|cia|comercio|industria)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
