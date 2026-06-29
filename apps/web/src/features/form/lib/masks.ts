/**
 * Máscaras de input pra blocos com formatação. Cada `MaskedFormat` tem:
 *  - `mask(raw)`: aplica formatação (recebe string crua, devolve formatada)
 *  - `unmask(value)`: remove formatação (devolve só dígitos/conteúdo bruto)
 *  - `isValid(value)`: validação completa do formato
 *  - `inputMode` / `autoComplete`: dicas de teclado mobile
 *  - `placeholder`: exemplo padrão pro input
 */

export type MaskedFormat =
  | "phone-br"
  | "cpf"
  | "cep"
  | "city-uf"
  | "email";

// ── PHONE BR (com DDD) ────────────────────────────────────────────
// (##) ####-#### (fixo) ou (##) #####-#### (móvel) — auto-detecta pela
// quantidade de dígitos. Aceita até 11 dígitos (DDD + 9 dígitos).
export function maskPhoneBr(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidPhoneBr(value: string): boolean {
  const d = value.replace(/\D/g, "");
  return d.length === 10 || d.length === 11;
}

// ── CPF ────────────────────────────────────────────────────────────
// ###.###.###-##
export function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Valida CPF com cálculo dos dígitos verificadores. Rejeita sequências
 * triviais (000.000.000-00, 111.111.111-11, etc.) que passam pela
 * matemática mas não são CPFs reais.
 */
export function isValidCpf(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // sequência repetida
  const calc = (slice: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += Number(slice[i]) * (factor - i);
    }
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const dv1 = calc(d.slice(0, 9), 10);
  const dv2 = calc(d.slice(0, 10), 11);
  return dv1 === Number(d[9]) && dv2 === Number(d[10]);
}

// ── CEP ────────────────────────────────────────────────────────────
// #####-###
export function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function isValidCep(value: string): boolean {
  return /^\d{5}-?\d{3}$/.test(value.replace(/\s/g, ""));
}

// ── Email ──────────────────────────────────────────────────────────
export function isValidEmail(value: string): boolean {
  // RFC 5322 simplificado — suficiente pra coleta em form (servidor valida
  // de novo se necessário).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ── Estados brasileiros (Cidade — UF) ──────────────────────────────
export const BR_STATES: Array<{ uf: string; name: string }> = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

// ── Helpers genéricos ──────────────────────────────────────────────

export function formatLabel(format: MaskedFormat): string {
  switch (format) {
    case "phone-br":
      return "Telefone com DDD";
    case "cpf":
      return "CPF";
    case "cep":
      return "CEP";
    case "city-uf":
      return "Cidade — UF";
    case "email":
      return "E-mail";
  }
}

export function formatPlaceholder(format: MaskedFormat): string {
  switch (format) {
    case "phone-br":
      return "(11) 91234-5678";
    case "cpf":
      return "000.000.000-00";
    case "cep":
      return "00000-000";
    case "city-uf":
      return "São Paulo";
    case "email":
      return "voce@exemplo.com";
  }
}

export function applyMask(format: MaskedFormat, raw: string): string {
  switch (format) {
    case "phone-br":
      return maskPhoneBr(raw);
    case "cpf":
      return maskCpf(raw);
    case "cep":
      return maskCep(raw);
    case "city-uf":
    case "email":
      return raw; // sem máscara — só validação
  }
}

export function isValidByFormat(format: MaskedFormat, value: string): boolean {
  if (!value) return false;
  switch (format) {
    case "phone-br":
      return isValidPhoneBr(value);
    case "cpf":
      return isValidCpf(value);
    case "cep":
      return isValidCep(value);
    case "email":
      return isValidEmail(value);
    case "city-uf":
      // city-uf valida na própria UI (cidade ≥ 2 chars + UF preenchida).
      return value.length > 0 && value.includes(" - ");
  }
}

export function inputModeFor(
  format: MaskedFormat,
): React.HTMLAttributes<HTMLInputElement>["inputMode"] {
  switch (format) {
    case "phone-br":
    case "cep":
      return "tel";
    case "cpf":
      return "numeric";
    case "email":
      return "email";
    case "city-uf":
      return "text";
  }
}

export function autoCompleteFor(format: MaskedFormat): string {
  switch (format) {
    case "phone-br":
      return "tel-national";
    case "email":
      return "email";
    case "cep":
      return "postal-code";
    case "city-uf":
      return "address-level2";
    case "cpf":
      return "off"; // navegadores autofill com dados sensíveis = ruim
  }
}
