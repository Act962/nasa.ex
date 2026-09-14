/**
 * Pontuação de compatibilidade entre uma transação do extrato e um lançamento
 * em aberto. Função pura: sem Prisma, sem I/O, testável isoladamente.
 *
 * A pontuação existe para ordenar candidatos, não para decidir sozinha. Acima
 * de `HIGH_CONFIDENCE` a tela oferece um clique; abaixo de `MIN_SUGGESTION` não
 * sugere nada, porque sugestão ruim custa mais caro que ausência de sugestão.
 */

export const HIGH_CONFIDENCE = 80;
export const MIN_SUGGESTION = 55;
/** Diferença mínima para o segundo colocado; abaixo disso a escolha é do usuário. */
export const AMBIGUITY_MARGIN = 5;

const MAX_DAYS_APART = 30;
const MAX_AMOUNT_DRIFT = 0.05;
const DAY_MS = 86_400_000;

export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface MatchableTransaction {
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  postedDate: Date;
  memo: string;
  counterpartyName: string | null;
  counterpartyDocumentDigits: string;
}

export interface MatchableEntry {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  status: string;
  amount: number;
  paidAmount: number;
  dueDate: Date;
  description: string;
  documentNumber: string | null;
  accountId: string | null;
  contactDocumentDigits: string;
  contactName: string | null;
}

export interface MatchScore {
  score: number;
  reasons: string[];
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function tokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / (a.size + b.size - shared);
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

/**
 * `null` quando o par é impossível — não é "zero pontos", é eliminação. Manter
 * candidatos impossíveis na lista faria a atribuição gulosa consumir um
 * lançamento que nunca poderia ser aquele.
 */
export function scoreCandidate(
  transaction: MatchableTransaction,
  entry: MatchableEntry,
): MatchScore | null {
  const expectedType = transaction.direction === "CREDIT" ? "RECEIVABLE" : "PAYABLE";
  if (entry.type !== expectedType) return null;
  if (entry.status === "PAID" || entry.status === "CANCELLED") return null;

  const outstanding = entry.amount - entry.paidAmount;
  if (outstanding <= 0) return null;

  const distanceInDays = daysBetween(transaction.postedDate, entry.dueDate);
  if (distanceInDays > MAX_DAYS_APART) return null;

  const reference = Math.max(outstanding, entry.amount);
  const drift = Math.abs(transaction.amountCents - reference) / reference;
  if (drift > MAX_AMOUNT_DRIFT && transaction.amountCents !== outstanding) return null;

  const reasons: string[] = [];
  let score = 0;

  if (transaction.amountCents === outstanding) {
    score += 50;
    reasons.push("valor igual ao saldo em aberto");
  } else if (transaction.amountCents === entry.amount) {
    score += 48;
    reasons.push("valor exato");
  } else {
    const difference = Math.abs(transaction.amountCents - outstanding);
    if (difference <= 100 || difference / outstanding <= 0.01) {
      score += 35;
      reasons.push("valor quase igual");
    } else {
      score += 15;
      reasons.push("valor próximo");
    }
  }

  if (distanceInDays === 0) {
    score += 25;
    reasons.push("mesmo dia");
  } else if (distanceInDays <= 2) {
    score += 20;
    reasons.push(`${Math.round(distanceInDays)} dia(s) de diferença`);
  } else if (distanceInDays <= 5) {
    score += 14;
    reasons.push("até 5 dias de diferença");
  } else if (distanceInDays <= 10) {
    score += 8;
    reasons.push("até 10 dias de diferença");
  } else {
    score += 3;
    reasons.push("dentro de 30 dias");
  }

  if (
    transaction.counterpartyDocumentDigits.length >= 11 &&
    transaction.counterpartyDocumentDigits === entry.contactDocumentDigits
  ) {
    score += 20;
    reasons.push("CPF/CNPJ confere");
  } else if (
    // Documento mascarado ainda carrega sinal: os dígitos visíveis precisam
    // bater nas mesmas posições.
    transaction.counterpartyDocumentDigits.length >= 5 &&
    entry.contactDocumentDigits.length > 0 &&
    entry.contactDocumentDigits.includes(transaction.counterpartyDocumentDigits)
  ) {
    score += 12;
    reasons.push("parte do documento confere");
  }

  if (transaction.counterpartyName && entry.contactName) {
    if (jaccard(tokens(transaction.counterpartyName), tokens(entry.contactName)) >= 0.6) {
      score += 10;
      reasons.push("nome do contato confere");
    }
  }

  const memoTokens = tokens(transaction.memo);
  if (jaccard(memoTokens, tokens(entry.description)) >= 0.3) {
    score += 6;
    reasons.push("descrição parecida");
  }

  if (entry.documentNumber && normalize(transaction.memo).includes(normalize(entry.documentNumber))) {
    score += 10;
    reasons.push("nº do documento aparece no extrato");
  }

  return { score: Math.min(score, 100), reasons };
}

export function confidenceOf(score: number): MatchConfidence {
  if (score >= HIGH_CONFIDENCE) return "HIGH";
  if (score >= MIN_SUGGESTION) return "MEDIUM";
  return "LOW";
}
