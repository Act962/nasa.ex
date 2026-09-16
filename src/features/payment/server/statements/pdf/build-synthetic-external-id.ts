import "server-only";

import { createHash } from "node:crypto";

// PDF não tem FITID. A identidade da transação é o que o banco imprime
// (dia, sentido, valor, histórico) mais a posição entre linhas idênticas do
// mesmo extrato — dois cafés iguais no mesmo dia continuam sendo dois.

export interface SyntheticExternalIdInput {
  bankAccountId: string;
  /** AAAA-MM-DD */
  postedDate: string;
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  normalizedMemo: string;
  /** 0 para a primeira ocorrência da mesma tupla no extrato, 1 para a segunda... */
  occurrenceIndex: number;
}

const MAX_MEMO_LENGTH = 80;

export function normalizeStatementMemo(memo: string): string {
  return memo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_MEMO_LENGTH);
}

export function buildSyntheticExternalId(input: SyntheticExternalIdInput): string {
  const seed = [
    input.bankAccountId,
    input.postedDate,
    input.direction,
    input.amountCents,
    input.normalizedMemo,
    input.occurrenceIndex,
  ].join("|");
  return `pdf:${createHash("sha256").update(seed).digest("hex")}`;
}
