/**
 * Atribuição de sugestões para um lote inteiro de transações.
 *
 * Gulosa e global: todos os pares possíveis são ordenados por pontuação e cada
 * lançamento é consumido uma única vez. Escolher o melhor candidato para cada
 * transação isoladamente erra sistematicamente no caso mais comum do mundo
 * real — doze parcelas de mesmo valor e datas próximas, em que a mesma parcela
 * seria sugerida para todas as transações.
 */

import {
  AMBIGUITY_MARGIN,
  MIN_SUGGESTION,
  confidenceOf,
  scoreCandidate,
  type MatchConfidence,
  type MatchableEntry,
  type MatchableTransaction,
} from "./score-match";

export interface Suggestion {
  entryId: string;
  score: number;
  confidence: MatchConfidence;
  reasons: string[];
  /** O segundo colocado ficou perto demais: a escolha é do usuário. */
  isAmbiguous: boolean;
  alternativeEntryIds: string[];
}

interface Pair {
  transactionId: string;
  entryId: string;
  score: number;
  reasons: string[];
}

export function assignMatches<T extends MatchableTransaction & { id: string }>(
  transactions: T[],
  entries: MatchableEntry[],
): Map<string, Suggestion> {
  const pairsByTransaction = new Map<string, Pair[]>();
  const allPairs: Pair[] = [];

  for (const transaction of transactions) {
    const pairs: Pair[] = [];
    for (const entry of entries) {
      const result = scoreCandidate(transaction, entry);
      if (!result || result.score < MIN_SUGGESTION) continue;
      const pair = {
        transactionId: transaction.id,
        entryId: entry.id,
        score: result.score,
        reasons: result.reasons,
      };
      pairs.push(pair);
      allPairs.push(pair);
    }
    pairs.sort((a, b) => b.score - a.score || a.entryId.localeCompare(b.entryId));
    pairsByTransaction.set(transaction.id, pairs);
  }

  // Desempate determinístico: mesma entrada produz sempre a mesma sugestão.
  allPairs.sort(
    (a, b) =>
      b.score - a.score ||
      a.transactionId.localeCompare(b.transactionId) ||
      a.entryId.localeCompare(b.entryId),
  );

  const takenEntries = new Set<string>();
  const resolved = new Map<string, Suggestion>();

  for (const pair of allPairs) {
    if (resolved.has(pair.transactionId)) continue;
    if (takenEntries.has(pair.entryId)) continue;

    const candidates = pairsByTransaction.get(pair.transactionId) ?? [];
    const runnerUp = candidates.find(
      (candidate) => candidate.entryId !== pair.entryId && !takenEntries.has(candidate.entryId),
    );

    resolved.set(pair.transactionId, {
      entryId: pair.entryId,
      score: pair.score,
      confidence: confidenceOf(pair.score),
      reasons: pair.reasons,
      isAmbiguous: Boolean(runnerUp && pair.score - runnerUp.score <= AMBIGUITY_MARGIN),
      alternativeEntryIds: candidates
        .filter((candidate) => candidate.entryId !== pair.entryId)
        .slice(0, 3)
        .map((candidate) => candidate.entryId),
    });
    takenEntries.add(pair.entryId);
  }

  return resolved;
}
