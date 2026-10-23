import { normalizePhoneToMetaE164 } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";

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

