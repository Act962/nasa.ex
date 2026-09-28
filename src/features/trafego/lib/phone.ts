import { normalizePhoneToMetaE164 } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";

/**
 * Normaliza o telefone digitado no wizard para o mesmo formato do `wa_id` que
 * o inbound do WhatsApp grava em `Lead.phone`. Sem isso o comprovante enviado
 * pelo cliente cria um segundo card em vez de cair no dele.
 *
 * Aceita "(86) 99822-1810", "86998221810", "+55 86 99822-1810" e devolve
 * "5586998221810". Devolve null para entradas curtas demais.
 */
export function normalizeWhatsappPhoneBr(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return normalizePhoneToMetaE164(withCountry);
}
