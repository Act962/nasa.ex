// Texto para a fala (spec 0083, RF-5 a RF-7): função pura, sem IA. O que se lê
// bem na tela ("R$ 150,00", "09/10", "*negrito*") soa mal ou vaza quando falado.

const SPOKEN_CHARACTERS_PER_SECOND = 15;
export const MAX_SPOKEN_SECONDS = 90;
const MAX_SPOKEN_LIST_ITEMS = 5;

const UNITS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function belowThousandInWords(value: number): string {
  if (value === 100) return "cem";
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);
  if (remainder > 0) {
    if (remainder < 20) parts.push(UNITS[remainder]);
    else {
      const units = remainder % 10;
      parts.push(units === 0 ? TENS[Math.floor(remainder / 10)] : `${TENS[Math.floor(remainder / 10)]} e ${UNITS[units]}`);
    }
  }
  return parts.join(" e ");
}

/** Inteiro de 0 a 999.999.999 por extenso. */
export function numberInWords(value: number): string {
  if (value < 1000) return value === 0 ? UNITS[0] : belowThousandInWords(value);
  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1000);
  const remainder = value % 1000;
  const parts: string[] = [];
  if (millions > 0) parts.push(millions === 1 ? "um milhão" : `${belowThousandInWords(millions)} milhões`);
  if (thousands > 0) parts.push(thousands === 1 ? "mil" : `${belowThousandInWords(thousands)} mil`);
  if (remainder > 0) parts.push(belowThousandInWords(remainder));
  // O "e" entra antes do último grupo quando ele é menor que cem ou centena cheia:
  // "mil e cinquenta", "um milhão e quinhentos mil", mas "mil duzentos e trinta".
  const lastGroupValue = remainder > 0 ? remainder : thousands;
  const needsFinalAnd = parts.length > 1 && (lastGroupValue < 100 || lastGroupValue % 100 === 0);
  if (!needsFinalAnd) return parts.join(" ");
  return `${parts.slice(0, -1).join(" ")} e ${parts[parts.length - 1]}`;
}

function currencyInWords(integerDigits: string, centDigits: string | undefined): string {
  const reais = Number(integerDigits.replace(/\./g, ""));
  const cents = centDigits ? Number(centDigits) : 0;
  if (!Number.isFinite(reais) || reais > 999_999_999) return `${integerDigits} reais`;
  const parts: string[] = [];
  if (reais > 0 || cents === 0) {
    const isRoundMillion = reais >= 1_000_000 && reais % 1_000_000 === 0;
    parts.push(`${numberInWords(reais)} ${reais === 1 ? "real" : isRoundMillion ? "de reais" : "reais"}`);
  }
  if (cents > 0) parts.push(`${numberInWords(cents)} ${cents === 1 ? "centavo" : "centavos"}`);
  return parts.join(" e ");
}

function dateInWords(dayDigits: string, monthDigits: string, yearDigits: string | undefined): string | null {
  const day = Number(dayDigits);
  const month = Number(monthDigits);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const spokenDay = day === 1 ? "primeiro" : numberInWords(day);
  const year = yearDigits ? Number(yearDigits.length === 2 ? `20${yearDigits}` : yearDigits) : null;
  return `${spokenDay} de ${MONTHS[month - 1]}${year ? ` de ${numberInWords(year)}` : ""}`;
}

const URL_PATTERN = /https?:\/\/\S+|\bwww\.\S+/gi;
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const LIST_MARKER = /^\s*(?:[•\-–*]|\d+[.)])\s+/;

/** Converte a resposta do WhatsApp em texto para ser falado. */
export function toSpeakableText(reply: string): string {
  return reply
    .replace(URL_PATTERN, "")
    .replace(EMOJI_PATTERN, "")
    .replace(/R\$\s?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?/g, (_match, integerDigits: string, centDigits?: string) =>
      currencyInWords(integerDigits, centDigits),
    )
    .replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/g, (match, dayDigits: string, monthDigits: string, yearDigits?: string) =>
      dateInWords(dayDigits, monthDigits, yearDigits) ?? match,
    )
    .replace(/\b(\d{1,2})h(\d{2})\b/g, "$1 e $2")
    .replace(/\b(\d{1,2})h\b/g, "$1 horas")
    .split("\n")
    .map((line) => line.replace(LIST_MARKER, "").replace(/[*_~`#>]/g, "").replace(/\s+[—–]\s+/g, ", ").trim())
    .filter(Boolean)
    .map((line) => (/[.!?:;,]$/.test(line) ? line : `${line}.`))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function estimateSpokenSeconds(speakableText: string): number {
  return Math.ceil(speakableText.length / SPOKEN_CHARACTERS_PER_SECOND);
}

const PIX_CODE_PATTERN = /000201\d{6,}/;
const SENSITIVE_PATTERN = /\b(?:pix|copia e cola|senha|c[oó]digo|token)\b/i;

/**
 * A resposta pode virar áudio? Fica em texto o que precisa ser lido, copiado
 * ou clicado, e o que não deve ser dito em voz alta perto de outras pessoas.
 */
export function canBeSpoken(reply: string): boolean {
  if (URL_PATTERN.test(reply)) return false;
  URL_PATTERN.lastIndex = 0;
  if (PIX_CODE_PATTERN.test(reply) || SENSITIVE_PATTERN.test(reply)) return false;
  const lines = reply.split("\n");
  if (lines.some((line) => line.includes(" | "))) return false;
  if (lines.filter((line) => LIST_MARKER.test(line)).length > MAX_SPOKEN_LIST_ITEMS) return false;
  const speakableText = toSpeakableText(reply);
  return speakableText.length > 0 && estimateSpokenSeconds(speakableText) <= MAX_SPOKEN_SECONDS;
}
