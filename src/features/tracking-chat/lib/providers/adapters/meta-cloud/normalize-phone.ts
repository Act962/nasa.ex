/**
 * Normaliza um telefone pra E.164 sem `+` no formato que a Meta Cloud
 * API espera no campo `to`.
 *
 * Por que existe (Fase 6):
 *  - O wa_id que a Meta entrega no webhook inbound pode vir SEM o 9º
 *    dígito brasileiro pra contas mobile antigas (`558688923098`, 12
 *    dígitos), mesmo que o número real seja `+55 86 9 8892-3098`.
 *  - A allowlist do sandbox e a maioria das interfaces externas espera o
 *    formato COM o 9 (13 dígitos). Mandar 12 dígitos pro Graph quando a
 *    allowlist tem 13 dispara `(#131030) Recipient phone number not in
 *    allowed list`.
 *  - O Lead.phone fica como a Meta deu (12 dígitos) — `Lead.phone` é
 *    fonte de verdade do wa_id, não do número humano. A normalização
 *    acontece SÓ na saída do adapter, antes do POST pro Graph.
 *
 * Comportamento:
 *  - **Strip non-digits** (`+`, espaços, `-`, parênteses). Frontend ou
 *    Lead.phone com formatação cosmética não quebra mais.
 *  - **Brasil mobile 12 dígitos sem 9** (`55 DD 8XXXXXXX`/`55 DD 9XXXXXXX`)
 *    → insere `9` entre DDD e os 8 dígitos finais. Mobile brasileiro
 *    sempre tem 9 hoje (regra ANATEL desde 2016); só sobra com 12 dígitos
 *    quando o wa_id foi cadastrado antes do 9º dígito ser obrigatório. O
 *    guard checa o 1º dígito do assinante (posição 4): mobile antigo
 *    sempre começava com `8` ou `9` — fixos começam com `2`–`5`.
 *  - **Brasil 13 dígitos** (já com 9), **internacional** (qualquer
 *    tamanho ≠ 12 ou não começa com 55), **fixo BR 12 dígitos** (1º
 *    dígito 2–5) → devolve como veio (só sem formatação). Idempotente.
 *
 * Por que o guard do 1º dígito (followup #12): sem ele, um fixo BR de 12
 * dígitos (`55 DD 3XXXXXXX`) ganharia um `9` espúrio → Meta 131030 ou,
 * pior, entrega ao número errado. Linhas fixas não recebem WhatsApp, mas
 * um lead cadastrado manualmente / importado por CSV pode trazer fixo.
 */
export function normalizePhoneToMetaE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Brasil mobile sem o 9º dígito: `55 DD 8XXXXXXX`/`55 DD 9XXXXXXX`.
  // Insere o 9 entre DDD (posições 2-3) e os 8 dígitos finais, mas só
  // quando o 1º dígito do assinante indica mobile (8 ou 9) — evita
  // corromper fixos BR (2-5).
  if (digits.length === 12 && digits.startsWith("55")) {
    const subscriberLeadingDigit = digits[4];
    const isLegacyBrazilMobile =
      subscriberLeadingDigit === "8" || subscriberLeadingDigit === "9";
    if (isLegacyBrazilMobile) {
      const ddd = digits.slice(2, 4);
      const rest = digits.slice(4);
      return `55${ddd}9${rest}`;
    }
  }

  return digits;
}
