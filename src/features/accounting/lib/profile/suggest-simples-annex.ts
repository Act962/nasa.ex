// Sugestão de Anexo do Simples a partir do CNAE principal. É só um ponto de
// partida: o enquadramento real depende da atividade exercida e o dono pode trocar.

export type SimplesAnnexCode = "I" | "II" | "III" | "IV" | "V";

export interface SimplesAnnexSuggestion {
  annex: SimplesAnnexCode;
  isFatorRSubject: boolean;
  reason: string;
}

interface AnnexRule {
  /** Prefixo dos dígitos do CNAE (ex.: "6911" para advocacia). */
  prefixes: string[];
  suggestion: SimplesAnnexSuggestion;
}

// Regras mais específicas (prefixo mais longo) vêm antes.
const ANNEX_RULES: AnnexRule[] = [
  { prefixes: ["6911"], suggestion: { annex: "IV", isFatorRSubject: false, reason: "Serviços advocatícios ficam no Anexo IV." } },
  { prefixes: ["812"], suggestion: { annex: "IV", isFatorRSubject: false, reason: "Limpeza e conservação ficam no Anexo IV." } },
  { prefixes: ["41", "42", "43"], suggestion: { annex: "IV", isFatorRSubject: false, reason: "Construção civil fica no Anexo IV." } },
  { prefixes: ["62", "63"], suggestion: { annex: "III", isFatorRSubject: true, reason: "Tecnologia da informação: Anexo III se a folha for ≥ 28% do faturamento (Fator R), senão Anexo V." } },
  { prefixes: ["73"], suggestion: { annex: "III", isFatorRSubject: true, reason: "Publicidade: Anexo III com Fator R ≥ 28%, senão Anexo V." } },
  { prefixes: ["71"], suggestion: { annex: "V", isFatorRSubject: true, reason: "Engenharia e arquitetura: Anexo V, que cai para o III com Fator R ≥ 28%." } },
  { prefixes: ["86"], suggestion: { annex: "III", isFatorRSubject: true, reason: "Saúde: Anexo III com Fator R ≥ 28%, senão Anexo V." } },
  { prefixes: ["45", "46", "47"], suggestion: { annex: "I", isFatorRSubject: false, reason: "Comércio fica no Anexo I." } },
  {
    prefixes: Array.from({ length: 24 }, (_, index) => String(10 + index)),
    suggestion: { annex: "II", isFatorRSubject: false, reason: "Indústria fica no Anexo II." },
  },
];

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function suggestSimplesAnnex(cnae: string | null | undefined): SimplesAnnexSuggestion | null {
  const digits = onlyDigits(cnae ?? "");
  if (digits.length < 2) return null;
  const sortedRules = ANNEX_RULES.flatMap((rule) => rule.prefixes.map((prefix) => ({ prefix, suggestion: rule.suggestion }))).sort(
    (left, right) => right.prefix.length - left.prefix.length,
  );
  const matchedRule = sortedRules.find((rule) => digits.startsWith(rule.prefix));
  return matchedRule?.suggestion ?? null;
}

/** "6201501" → "6201-5/01" (aceita digitação parcial). */
export function formatCnae(value: string): string {
  const digits = onlyDigits(value).slice(0, 7);
  if (digits.length <= 4) return digits;
  if (digits.length === 5) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 5)}/${digits.slice(5)}`;
}

/** Normaliza telefone BR para só dígitos com DDI 55. Retorna null se inválido. */
export function normalizeBrPhone(value: string): string | null {
  const digits = onlyDigits(value);
  const nationalDigits = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (nationalDigits.length !== 10 && nationalDigits.length !== 11) return null;
  return `55${nationalDigits}`;
}

/** "5586999998888" → "+55 (86) 99999-8888". */
export function formatBrPhone(value: string): string {
  const digits = onlyDigits(value);
  const nationalDigits = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const areaCode = nationalDigits.slice(0, 2);
  const subscriber = nationalDigits.slice(2);
  if (!subscriber) return areaCode ? `(${areaCode}` : "";
  const splitAt = subscriber.length > 8 ? 5 : 4;
  const formatted = subscriber.length > splitAt ? `${subscriber.slice(0, splitAt)}-${subscriber.slice(splitAt)}` : subscriber;
  return `${digits.startsWith("55") && digits.length >= 12 ? "+55 " : ""}(${areaCode}) ${formatted}`;
}
