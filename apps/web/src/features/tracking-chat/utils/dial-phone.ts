/**
 * Helper pra disparar uma ligação nativa via `tel:` link, usando o app
 * de telefone padrão do dispositivo (iOS Phone, Android Dialer, FaceTime
 * no macOS, Phone Link no Windows 11). Liga via OPERADORA — não é
 * VoIP, não tem gravação, não cobra STARs. Sprint 2 troca por Twilio
 * com gravação + transcrição.
 *
 * Normalização do número:
 *  - Remove caracteres não-numéricos exceto o `+` inicial
 *  - Se vier sem DDI (10-11 dígitos brasileiros), prefixa `+55`
 *  - Já vem com `+`: respeita formato E.164
 *  - Se a normalização falhar (string vazia, sem dígitos), vira no-op
 *
 * SSR-safe: em ambiente sem `window`, vira no-op sem erro.
 */
export function dialPhone(phone: string | null | undefined): void {
  if (typeof window === "undefined" || !phone) return;

  // Mantém o `+` se já estiver no início, remove tudo que não é dígito
  // depois disso.
  const hasPlus = phone.trim().startsWith("+");
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return;

  let e164: string;
  if (hasPlus) {
    e164 = `+${digits}`;
  } else if (digits.length === 10 || digits.length === 11) {
    // Brasileiro sem DDI: 11999998888 ou 1133334444 — prefixa +55
    e164 = `+55${digits}`;
  } else if (digits.length === 12 || digits.length === 13) {
    // Provavelmente já tem DDI (55 + 10/11 dígitos), só precisa do `+`
    e164 = `+${digits}`;
  } else {
    // Formato inesperado — tenta de qualquer jeito; SO mostra erro pro user
    e164 = `+${digits}`;
  }

  // `window.location.href` aciona o handler `tel:` do SO. Não abre nova
  // aba (que browsers bloqueiam pra `tel:`), apenas dispara o intent.
  window.location.href = `tel:${e164}`;
}
