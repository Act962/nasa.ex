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
 *  - **Mobile BR de 12 dígitos sem 9** (`55 DD 8XXXXXXX`) → insere `9`
 *    entre DDD e os 8 dígitos finais.
 *  - **Fixo BR de 12 dígitos** (`55 DD 3XXXXXXX`), **BR 13 dígitos** (já
 *    com 9), **internacional** → devolve como veio (só sem formatação).
 *    Idempotente.
 *
 * Por que a faixa importa (spec 0010, RF-1/RF-2): a versão anterior
 * inseria o `9` em QUALQUER número BR de 12 dígitos. Um fixo
 * (`5586 3221-1234`) virava `5586932211234` — um celular existente de
 * outra pessoa. O envio não falhava: entregava a mensagem ao
 * destinatário errado, vazando dados do lead. Pela numeração da ANATEL,
 * fixos ocupam a faixa `2`–`5` e móveis `6`–`9`; só a segunda recebeu o
 * 9º dígito na migração. Checar o primeiro dígito do número local separa
 * as duas classes sem ambiguidade.
 */

/** Primeiro dígito do número local que identifica faixa móvel (ANATEL). */
const BR_MOBILE_LOCAL_PREFIXES = new Set(["6", "7", "8", "9"]);

export function normalizePhoneToMetaE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Brasil mobile sem o 9º dígito: `55 DD XXXXXXXX` (12 dígitos).
  // Insere o 9 entre DDD (posições 2-3) e os 8 dígitos finais — mas só
  // quando o número local está na faixa móvel. Fixo BR fica intocado.
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const localNumber = digits.slice(4);
    if (BR_MOBILE_LOCAL_PREFIXES.has(localNumber[0])) {
      return `55${ddd}9${localNumber}`;
    }
  }

  return digits;
}
