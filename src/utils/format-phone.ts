import { normalizePhoneToMetaE164 } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";
import { countries } from "@/types/some";

export function phoneMask(value: string | null) {
  if (!value) return "";

  value = value.replace(/\D/g, "");

  return value
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
}

export const normalizePhone = (value = "") => value.replace(/\D/g, "");

export function phoneMaskFull(value: string | null) {
  if (!value) return "";

  const digits = value.replace(/\D/g, "").slice(0, 13);

  // Com código do país (+55 (85) 98888-8888)
  if (digits.length > 11) {
    return digits
      .replace(/^(\d{2})(\d{2})(\d)/, "+$1 ($2) $3")
      .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
  }

  if (digits.length <= 10) {
    // Telefone fixo (85) 8888-8888
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  // Celular (85) 98888-8888
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Normaliza o telefone digitado para o mesmo formato do `wa_id` que o inbound do
 * WhatsApp grava em `Lead.phone`: "(86) 99822-1810", "86998221810" e
 * "+55 86 99822-1810" viram "5586998221810". Devolve null para entrada curta demais.
 */
export function normalizeWhatsappPhoneBr(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return normalizePhoneToMetaE164(withCountry);
}

/** Primeiro dígito do número local que identifica faixa fixa (ANATEL: 2 a 5). */
const BR_LANDLINE_LOCAL_PREFIXES = new Set(["2", "3", "4", "5"]);

/**
 * Problema de formato de um número para WhatsApp, em frase para a tela; null quando
 * parece certo. Só formato: se o número existe no WhatsApp, só o envio confirma.
 */
export function describeWhatsappPhoneProblem(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length < 10) return "Número incompleto: confira o DDD e os dígitos.";

  const isBrazilian = digits.length <= 11 || digits.startsWith("55");
  if (!isBrazilian) return null;
  if (digits.length > 13) return "Número longo demais para um telefone brasileiro.";

  const local = digits.length <= 11 ? digits.slice(2) : digits.slice(4);
  if (local.length === 9 && local[0] !== "9") {
    return "Celular com 9 dígitos precisa começar com 9 depois do DDD.";
  }
  if (local.length === 8 && BR_LANDLINE_LOCAL_PREFIXES.has(local[0])) {
    return "Parece telefone fixo, que normalmente não tem WhatsApp.";
  }
  return null;
}

export type PhoneCountry = (typeof countries)[number];

const BRAZIL_DDI = "55";
const MAX_E164_DIGITS = 15;
const COUNTRIES_BY_LONGEST_DDI = [...countries].sort((first, second) => second.ddi.length - first.ddi.length);

export function toDdiDigits(country: PhoneCountry): string {
  return country.ddi.replace(/\D/g, "");
}

/**
 * Separa o código do país de um telefone salvo. Até 11 dígitos é número nacional antigo, sem
 * código: fica com o país padrão.
 */
export function splitPhoneCountry(
  raw: string | null | undefined,
  fallbackCountry: PhoneCountry = countries[0],
): { country: PhoneCountry; local: string } {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length <= 11) return { country: fallbackCountry, local: digits };
  const country = COUNTRIES_BY_LONGEST_DDI.find((candidate) => digits.startsWith(toDdiDigits(candidate)));
  return country
    ? { country, local: digits.slice(toDdiDigits(country).length) }
    : { country: fallbackCountry, local: digits };
}

/** Telefone só com dígitos e com o código do país ("5586999538570"), o formato do WhatsApp. */
export function toInternationalPhoneDigits(raw: string | null | undefined, fallbackCountry?: PhoneCountry): string {
  const { country, local } = splitPhoneCountry(raw, fallbackCountry);
  return local ? `${toDdiDigits(country)}${local}` : "";
}

/** Número local na máscara do país: DDD no Brasil, só dígitos nos outros. */
export function maskLocalPhone(local: string, country: PhoneCountry): string {
  const digits = local.replace(/\D/g, "");
  if (toDdiDigits(country) === BRAZIL_DDI) return phoneMaskFull(digits.slice(0, 11));
  return digits.slice(0, MAX_E164_DIGITS - toDdiDigits(country).length);
}

/** "+55 (86) 99953-8570" para a tela. */
export function formatPhoneWithCountry(raw: string | null | undefined): string {
  const { country, local } = splitPhoneCountry(raw);
  return local ? `${country.ddi} ${maskLocalPhone(local, country)}` : "";
}

/** País do navegador (região do idioma, ex.: pt-BR), ou Brasil quando não dá para saber. */
export function detectBrowserPhoneCountry(): PhoneCountry {
  if (typeof navigator === "undefined") return countries[0];
  for (const language of navigator.languages ?? [navigator.language]) {
    const region = language.split("-")[1]?.toUpperCase();
    const country = countries.find((candidate) => candidate.code === region);
    if (country) return country;
  }
  return countries[0];
}

