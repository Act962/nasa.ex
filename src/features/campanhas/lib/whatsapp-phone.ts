/**
 * Normaliza o "9º dígito" de celulares brasileiros para o formato que a Meta
 * Cloud API espera (`55 + DDD + 9 + 8 dígitos`).
 *
 * Muitos leads são cadastrados no formato antigo `55 + DDD + 8 dígitos` (sem o
 * 9), e o WhatsApp rejeita esse número. Aqui, se for um número BR (`55`) com 8
 * dígitos locais e prefixo de móvel (6–9), inserimos o `9` faltante. Fixos (8
 * dígitos iniciando em 2–5), números que já têm o 9, e não-BR ficam intactos.
 *
 * Entrada: só-dígitos (já passou por `normalizePhone`). Idempotente.
 */
export function toWhatsAppBrazilPhone(digits: string): string {
  if (!digits.startsWith("55")) return digits;

  const afterCountry = digits.slice(2); // DDD(2) + local
  if (afterCountry.length !== 10) return digits; // não é DDD + 8 dígitos

  const areaCode = afterCountry.slice(0, 2);
  const localNumber = afterCountry.slice(2); // 8 dígitos
  const firstDigit = localNumber[0];

  // Móvel sem o 9 → prefixo local 6–9. Fixo (2–5) não recebe o 9.
  if (firstDigit >= "6" && firstDigit <= "9") {
    return `55${areaCode}9${localNumber}`;
  }
  return digits;
}
