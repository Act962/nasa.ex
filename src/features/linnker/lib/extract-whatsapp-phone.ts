/**
 * Extrai o número de WhatsApp em formato E.164 (sem `+`) a partir
 * dos `socialLinks` de uma LinnkerPage.
 *
 * `socialLinks` é JSON array de `{ platform, url }`. Procura o
 * primeiro item com `platform === "whatsapp"` (case-insensitive)
 * e parseia a URL pra extrair só dígitos.
 *
 * Formatos suportados (validados em produção):
 *   - https://wa.me/5586999990000
 *   - https://wa.me/+5586999990000
 *   - wa.me/5586999990000
 *   - https://api.whatsapp.com/send?phone=5586999990000
 *   - https://web.whatsapp.com/send?phone=5586999990000
 *   - wa://send?phone=5586999990000
 *   - tel:+5586999990000
 *   - apenas dígitos: "5586999990000"
 *
 * Retorna `null` se não achar WhatsApp ou se a URL tem menos de
 * 8 dígitos (validação mínima E.164 mais 1 dígito de país).
 */

export type SocialLink = { platform: string; url: string };

const MIN_DIGITS = 8;

export function extractWhatsappPhone(
  socialLinks: SocialLink[] | undefined | null,
): string | null {
  if (!Array.isArray(socialLinks)) return null;

  const wpp = socialLinks.find(
    (link) =>
      typeof link?.platform === "string" &&
      link.platform.toLowerCase() === "whatsapp",
  );
  if (!wpp?.url) return null;

  // Estratégia: tirar tudo que não é dígito, deixar só o número.
  // Pra URLs com query string (`?phone=...`) o regex acima já
  // pega os dígitos do número junto com qualquer outro número
  // na URL (pouco provável dar conflito porque `phone=` é o
  // único query param numérico nesses padrões).
  const digits = wpp.url.replace(/\D+/g, "");
  if (digits.length < MIN_DIGITS) return null;

  // Se o número não começar com código de país (Brasil é "55"),
  // assumimos Brasil. Heurística defensiva: se tem 10 ou 11
  // dígitos (DDD + número), prepend "55".
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Constrói URL `wa.me/<phone>?text=<text>` formatada — pronta pra
 * abrir o app WhatsApp com mensagem pré-digitada.
 */
export function buildWaMeUrl(
  phoneDigits: string,
  text: string | undefined,
): string {
  const base = `https://wa.me/${phoneDigits}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}
