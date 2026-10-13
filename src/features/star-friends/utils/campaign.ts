// Regras puras da campanha de sorteio (spec 0102): sem banco e sem IA, para o
// cálculo dos números e o bloqueio de cupom repetido serem testáveis sozinhos.

import { toMemberPhone } from "./balance";

export type ReceiptReading = {
  issuerDocument: string | null;
  receiptNumber: string | null;
  accessKey: string | null;
  issuedAt: string | null;
  totalCents: number | null;
  isFiscal: boolean;
  confidence: number;
};

export const ACCESS_KEY_LENGTH = 44;
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export const RECEIPT_FLAGS = {
  noIdentifier: "Sem chave de acesso e sem número do cupom",
  noIssuer: "CNPJ do emissor não foi lido",
  noIssuedAt: "Data e hora não foram lidas",
  lowConfidence: "Leitura com baixa confiança",
  notFiscal: "Comprovante não fiscal",
  yearCorrected: "Ano da compra lido fora do período; considerado o ano da campanha",
  noTotal: "Valor total não foi lido",
  readerUnavailable: "Leitura automática indisponível",
} as const;

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Soma ponderada do módulo 11, com os pesos aplicados da direita para a esquerda. */
function weightedSum(digits: string, weightAt: (positionFromRight: number) => number): number {
  return [...digits].reverse().reduce((sum, digit, positionFromRight) => sum + Number(digit) * weightAt(positionFromRight), 0);
}

function checkDigitOf(weightedTotal: number): number {
  const remainder = weightedTotal % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function modulo11Weight(positionFromRight: number): number {
  return (positionFromRight % 8) + 2;
}

/**
 * CNPJ lido do cupom, só quando os dígitos verificadores conferem. A leitura por IA engole ou
 * troca dígito com frequência: CNPJ que não confere conta como não lido, em vez de reprovar o
 * cupom como "de outra loja". CNPJ de outra loja confere e continua reprovando.
 */
export function toValidCnpj(value: string | null | undefined): string | null {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return null;
  const firstCheck = checkDigitOf(weightedSum(digits.slice(0, 12), modulo11Weight));
  const secondCheck = checkDigitOf(weightedSum(digits.slice(0, 13), modulo11Weight));
  return firstCheck === Number(digits[12]) && secondCheck === Number(digits[13]) ? digits : null;
}

/** Chave de acesso da NFC-e: 44 dígitos, o último é o verificador dos outros 43. */
export function toAccessKey(value: string | null | undefined): string | null {
  const digits = onlyDigits(value);
  if (digits.length !== ACCESS_KEY_LENGTH) return null;
  const expectedCheck = checkDigitOf(weightedSum(digits.slice(0, ACCESS_KEY_LENGTH - 1), modulo11Weight));
  return expectedCheck === Number(digits[ACCESS_KEY_LENGTH - 1]) ? digits : null;
}

/** RF-7: a sobra de um cupom soma no próximo. */
export function computeLuckyNumbers(input: { carryOverCents: number; totalCents: number; amountPerNumberCents: number }): {
  numbers: number;
  carryOverCents: number;
} {
  const availableCents = input.carryOverCents + input.totalCents;
  const numbers = Math.floor(availableCents / input.amountPerNumberCents);
  return { numbers, carryOverCents: availableCents - numbers * input.amountPerNumberCents };
}

/**
 * Impressão digital dos dados do cupom (RF-6). Só existe quando há número do cupom: sem ele,
 * dois cupons diferentes do mesmo minuto e valor seriam confundidos. Esses ficam para a varredura.
 */
export function buildReceiptFingerprint(reading: ReceiptReading): string | null {
  const receiptNumber = onlyDigits(reading.receiptNumber).replace(/^0+/, "");
  const issuerDocument = onlyDigits(reading.issuerDocument);
  if (!receiptNumber || !issuerDocument || reading.totalCents === null) return null;
  const issuedDay = reading.issuedAt ? reading.issuedAt.slice(0, 10) : "sem-data";
  return [issuerDocument, receiptNumber, issuedDay, reading.totalCents].join("|");
}

export function receiptFlagsOf(reading: ReceiptReading): string[] {
  const flags: string[] = [];
  if (!toAccessKey(reading.accessKey) && !onlyDigits(reading.receiptNumber)) flags.push(RECEIPT_FLAGS.noIdentifier);
  if (!onlyDigits(reading.issuerDocument)) flags.push(RECEIPT_FLAGS.noIssuer);
  if (!reading.issuedAt) flags.push(RECEIPT_FLAGS.noIssuedAt);
  if (reading.confidence < LOW_CONFIDENCE_THRESHOLD) flags.push(RECEIPT_FLAGS.lowConfidence);
  if (!reading.isFiscal) flags.push(RECEIPT_FLAGS.notFiscal);
  return flags;
}

/** Celular brasileiro sem o nono dígito, para comparar as duas grafias do mesmo número. */
function withoutNinthDigit(phone: string): string {
  return phone.length === 13 && phone.startsWith("55") && phone[4] === "9" ? phone.slice(0, 4) + phone.slice(5) : phone;
}

/** RF-4: o número digitado só é comparado com o de quem está escrevendo; nunca vira consulta. */
export function isSamePhone(typedPhone: string, senderPhone: string): boolean {
  const typedDigits = onlyDigits(typedPhone);
  if (typedDigits.length < 10) return false;
  return withoutNinthDigit(toMemberPhone(typedDigits)) === withoutNinthDigit(toMemberPhone(senderPhone));
}

const LUCKY_CODE_DIGITS = 6;

export function formatLuckyCode(value: number): string {
  return String(value % 10 ** LUCKY_CODE_DIGITS).padStart(LUCKY_CODE_DIGITS, "0");
}

export function isIssuerAccepted(issuerDocument: string | null, acceptedDocuments: string[]): boolean {
  if (acceptedDocuments.length === 0) return true;
  const issuerDigits = onlyDigits(issuerDocument);
  // CNPJ ilegível não reprova: entra com alerta (RF-9).
  if (!issuerDigits) return true;
  return acceptedDocuments.some((accepted) => onlyDigits(accepted) === issuerDigits);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Versão do texto das regras: o aceite guarda qual texto o cliente viu. */
export function rulesVersionOf(rulesSummary: string, rulesUrl: string | null): string {
  const source = `${rulesSummary.trim()}|${rulesUrl ?? ""}`;
  let hash = 0;
  for (let index = 0; index < source.length; index++) hash = (hash * 31 + source.charCodeAt(index)) | 0;
  return `v${(hash >>> 0).toString(36)}`;
}

export type SweepReceipt = {
  id: string;
  issuerDocument: string | null;
  receiptNumber: string | null;
  issuedAt: Date | null;
  totalCents: number | null;
};

const BRASILIA_OFFSET_MS = 3 * 60 * 60_000;
const SAME_PURCHASE_TOLERANCE_MS = 2 * 60_000;
const ISSUED_AT_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/;

/** Dia (AAAA-MM-DD) no horário de Brasília: o servidor roda em UTC, onde o dia vira às 21h de lá. */
export function toBrasiliaDay(moment: Date): string {
  return new Date(moment.getTime() - BRASILIA_OFFSET_MS).toISOString().slice(0, 10);
}

export function startOfBrasiliaDay(moment: Date): Date {
  return new Date(`${toBrasiliaDay(moment)}T00:00:00-03:00`);
}

/** Data e hora lidas do cupom, impressas no horário de Brasília. Aceita a leitura com ou sem hora e segundos. */
export function parseIssuedAt(issuedAt: string | null): Date | null {
  const match = issuedAt?.trim().match(ISSUED_AT_PATTERN);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T${match[2] ?? "00"}:${match[3] ?? "00"}:00-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * A leitura erra o ano com frequência (2026 vira 2023) e acerta dia e mês. Quando a data lida cai
 * fora do período mas o mesmo dia e hora, no ano da campanha, cai dentro, devolve a data corrigida
 * no formato da leitura. `null` = nada a corrigir.
 */
export function correctMisreadYear(issuedAt: Date, period: { startsAt: Date; endsAt: Date }): string | null {
  if (issuedAt >= period.startsAt && issuedAt <= period.endsAt) return null;
  const printedClock = new Date(issuedAt.getTime() - BRASILIA_OFFSET_MS).toISOString().slice(0, 16);
  const campaignYears = new Set([toBrasiliaDay(period.startsAt).slice(0, 4), toBrasiliaDay(period.endsAt).slice(0, 4)]);
  for (const campaignYear of campaignYears) {
    const candidateText = `${campaignYear}${printedClock.slice(4)}`;
    const candidate = parseIssuedAt(candidateText);
    if (candidate && candidate >= period.startsAt && candidate <= period.endsAt) return candidateText;
  }
  return null;
}

/** Dia e minuto do dia no horário de Brasília, que é o impresso no cupom. */
function brasiliaClockOf(issuedAt: Date): { day: string; hasTime: boolean } {
  const local = new Date(issuedAt.getTime() - BRASILIA_OFFSET_MS).toISOString();
  return { day: local.slice(0, 10), hasTime: local.slice(11, 16) !== "00:00" };
}

function withoutLeadingZeros(receiptNumber: string | null): string {
  return (receiptNumber ?? "").replace(/^0+/, "");
}

/**
 * Mesma compra na varredura (RF-10): mesmo emissor, mesmo dia e mesmo total. A hora só separa dois
 * cupons quando foi lida nos dois e difere em mais de dois minutos: a leitura da hora falha com
 * frequência em foto ruim, e sem ela a dúvida pesa contra o cupom mais novo. Números de cupom
 * diferentes, lidos nos dois, provam que são compras distintas.
 */
function isSamePurchase(earlier: SweepReceipt, later: SweepReceipt): boolean {
  if (earlier.issuerDocument && later.issuerDocument && earlier.issuerDocument !== later.issuerDocument) return false;
  const earlierNumber = withoutLeadingZeros(earlier.receiptNumber);
  const laterNumber = withoutLeadingZeros(later.receiptNumber);
  if (earlierNumber && laterNumber) return earlierNumber === laterNumber;
  if (earlier.totalCents === null || earlier.totalCents !== later.totalCents) return false;
  if (!earlier.issuedAt || !later.issuedAt) return false;
  const earlierClock = brasiliaClockOf(earlier.issuedAt);
  const laterClock = brasiliaClockOf(later.issuedAt);
  if (earlierClock.day !== laterClock.day) return false;
  if (!earlierClock.hasTime || !laterClock.hasTime) return true;
  return Math.abs(earlier.issuedAt.getTime() - later.issuedAt.getTime()) <= SAME_PURCHASE_TOLERANCE_MS;
}

/** RF-10: todo cupom que repete a compra de outro mais antigo é anulado. Recebe em ordem de chegada. */
export function findReceiptsToVoid(receiptsOldestFirst: SweepReceipt[]): Map<string, string> {
  const keptReceipts: SweepReceipt[] = [];
  const duplicateOfByReceipt = new Map<string, string>();
  for (const receipt of receiptsOldestFirst) {
    const original = keptReceipts.find((kept) => isSamePurchase(kept, receipt));
    if (original) duplicateOfByReceipt.set(receipt.id, original.id);
    else keptReceipts.push(receipt);
  }
  return duplicateOfByReceipt;
}
