/**
 * Helpers de formatação + validação de telefone BR pra WhatsApp.
 *
 * - `maskBR(raw)`: aplica máscara progressiva conforme o user digita.
 *   Aceita strings sujas (com letras, espaços, símbolos) — extrai dígitos
 *   e formata até 11 dígitos.
 *
 * - `isValidBRWhatsApp(digitsOnly)`: valida que é um celular BR
 *   plausível pra WhatsApp:
 *     • 11 dígitos exatos (DDD 2 + 9 + 8 dígitos)
 *     • DDD entre 11-99 (cobre todos os DDDs ativos do Brasil)
 *     • 9° dígito presente (= dígito após DDD deve ser '9' — pessoal,
 *       não fixo). WhatsApp comercial em fixo não é o caso comum.
 *
 * - `digitsOf(masked)`: extrai apenas os dígitos de uma string mascarada.
 *
 * Validação REAL contra base do WhatsApp (uazapi /chat/check) fica como
 * próxima iteração — pra MVP a validação local elimina 99% dos erros
 * de digitação.
 */

/** DDDs ativos no Brasil (conforme ANATEL). */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
  21, 22, 24, // RJ
  27, 28, // ES
  31, 32, 33, 34, 35, 37, 38, // MG
  41, 42, 43, 44, 45, 46, // PR
  47, 48, 49, // SC
  51, 53, 54, 55, // RS
  61, // DF
  62, 64, // GO
  63, // TO
  65, 66, // MT
  67, // MS
  68, // AC
  69, // RO
  71, 73, 74, 75, 77, // BA
  79, // SE
  81, 87, // PE
  82, // AL
  83, // PB
  84, // RN
  85, 88, // CE
  86, 89, // PI
  91, 93, 94, // PA
  92, 97, // AM
  95, // RR
  96, // AP
  98, 99, // MA
]);

/** Extrai só dígitos de uma string. */
export function digitsOf(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Aplica máscara BR conforme digita. Formatos progressivos:
 *   ""              →  ""
 *   "1"             →  "(1"
 *   "11"            →  "(11"
 *   "119"           →  "(11) 9"
 *   "11999"         →  "(11) 999"
 *   "11999999999"   →  "(11) 99999-9999"
 *   "1199999999"    →  "(11) 9999-9999"  (fixo 10 dígitos)
 *
 * Limite: 11 dígitos. Acima disso, ignora o excesso (paste de número
 * com código do país aceita os 11 últimos).
 */
export function maskBR(input: string): string {
  let d = digitsOf(input);
  // Se veio com código do país (55), descarta — o user provavelmente
  // colou de um link wa.me.
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);

  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  // Decisão 10 vs 11 dígitos: se tem 11, usa formato celular
  // "99999-9999"; se tem 10, formato fixo/antigo "9999-9999".
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Valida se uma string de dígitos puros (sem máscara) representa um
 * celular BR válido pra WhatsApp.
 *
 * Regras:
 *   - 11 dígitos exatos (DDD + 9 + 8)
 *   - DDD entre os 67 DDDs ativos do Brasil
 *   - 9° dígito presente (terceira posição = '9')
 */
export function isValidBRWhatsApp(digits: string): boolean {
  if (digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (!VALID_DDDS.has(ddd)) return false;
  // 3ª posição é o "9" do celular brasileiro. WhatsApp normalmente
  // não roda em fixo (10 dígitos).
  if (digits[2] !== "9") return false;
  return true;
}
