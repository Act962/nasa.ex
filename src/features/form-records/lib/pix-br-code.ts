// "PIX Copia e Cola" estático (BR Code, padrão EMV do Banco Central), com valor. Função pura
// (spec 0081, RF-19): não fala com banco nem gateway, só monta o texto que o app do banco lê.

const PIX_GUI = "br.gov.bcb.pix";
const MAX_NAME_LENGTH = 25;
const MAX_CITY_LENGTH = 15;
const MAX_TXID_LENGTH = 25;

export interface PixBrCodeInput {
  /** Chave como cadastrada: CPF/CNPJ, e-mail, telefone ou aleatória. */
  pixKey: string;
  receiverName: string;
  receiverCity: string;
  amountCents: number;
  /** Identificador da cobrança (só letras e números). Sem ele, vai o "***" do padrão. */
  transactionId?: string;
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** O padrão só aceita ASCII: "São Luís" vira "SAO LUIS". */
function toAsciiUpper(text: string, maxLength: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLength)
    .trim();
}

/**
 * Telefone vira "+55DDDNÚMERO", como o Banco Central exige; CPF e CNPJ ficam só com dígitos;
 * e-mail em minúsculas; chave aleatória como veio.
 */
export function normalizePixKey(rawKey: string): string {
  const key = rawKey.trim();
  if (key.includes("@")) return key.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return key.toLowerCase();
  if (key.startsWith("+")) return `+${key.replace(/\D/g, "")}`;
  const digits = key.replace(/\D/g, "");
  const hasPhoneFormatting = /[()\s]/.test(key) && digits.length >= 10 && digits.length <= 11;
  // 11 dígitos sem formatação é ambíguo (CPF ou celular): celular tem DDD válido e o 9 na terceira posição.
  const looksLikeMobile = digits.length === 11 && digits[2] === "9" && !isValidCpf(digits);
  if (hasPhoneFormatting || looksLikeMobile) return `+55${digits}`;
  return digits || key;
}

function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const checkDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index++) sum += Number(digits[index]) * (length + 1 - index);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como o padrão manda. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index++) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixBrCode(input: PixBrCodeInput): string {
  const transactionId = (input.transactionId ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, MAX_TXID_LENGTH) || "***";
  const amount = (input.amountCents / 100).toFixed(2);
  const payload =
    field("00", "01") +
    field("26", field("00", PIX_GUI) + field("01", normalizePixKey(input.pixKey))) +
    field("52", "0000") +
    field("53", "986") +
    (input.amountCents > 0 ? field("54", amount) : "") +
    field("58", "BR") +
    field("59", toAsciiUpper(input.receiverName, MAX_NAME_LENGTH) || "RECEBEDOR") +
    field("60", toAsciiUpper(input.receiverCity, MAX_CITY_LENGTH) || "BRASIL") +
    field("62", field("05", transactionId)) +
    "6304";
  return payload + crc16(payload);
}
