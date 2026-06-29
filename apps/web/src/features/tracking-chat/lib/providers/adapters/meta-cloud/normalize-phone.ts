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
 *  - **Brasil 12 dígitos sem 9** (`55 DD XXXXXXXX`) → insere `9` entre
 *    DDD e os 8 dígitos finais. Mobile brasileiro sempre tem 9 hoje
 *    (regra ANATEL desde 2016); só sobra com 12 dígitos quando o wa_id
 *    foi cadastrado antes do 9º dígito ser obrigatório.
 *  - **Brasil 13 dígitos** (já com 9), **internacional** (qualquer
 *    tamanho ≠ 12 ou não começa com 55) → devolve como veio (só sem
 *    formatação). Idempotente.
 *
 * Limitação consciente: telefones BR fixos (8 dígitos sem o 9 inicial)
 * em DDD válido não existem no WhatsApp (linhas fixas não recebem msg).
 * Se um dia receber 12 dígitos BR de uma fonte exótica que NÃO seja
 * mobile sem 9, o normalize vai adicionar 9 incorretamente. Aceito pelo
 * pareto: 99,9% dos casos são mobile sem o 9.
 */
export function normalizePhoneToMetaE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Brasil mobile sem o 9º dígito: `55 DD XXXXXXXX` (12 dígitos).
  // Insere o 9 entre DDD (positions 2-3) e os 8 dígitos finais.
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    return `55${ddd}9${rest}`;
  }

  return digits;
}
