/**
 * Detecção de loop textual em mensagens geradas pela IA.
 *
 * Cenário: AI_GENERATE_TEXT em um LOOP_OVER pode gerar mensagens muito
 * similares iteração após iteração (IA "engessou"), o que causa spam pro
 * lead. Este helper compara a mensagem nova com as N anteriores e retorna
 * um score 0-1 (1 = idêntico). Se score > threshold, o caller deve:
 *  - injetar instrução adicional no prompt pra variar
 *  - OU pular a iteração
 *  - OU marcar o nó com warning visual
 *
 * Estratégia: bag-of-words com cosine similarity (sem embedding pra evitar
 * cobrança extra de API). Aceitável pra detecção grosseira de repetição.
 */

const STOP_WORDS = new Set([
  "a", "o", "de", "da", "do", "que", "e", "em", "um", "uma", "os", "as", "no",
  "na", "para", "com", "se", "por", "mais", "como", "mas", "ou", "ja", "ele",
  "ela", "voce", "seu", "sua", "the", "a", "an", "and", "or", "of", "to", "is",
  "it", "in", "on", "at", "for", "with", "from", "by", "as", "this", "that",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function frequencyVector(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let aSum = 0;
  let bSum = 0;
  for (const [, v] of a) aSum += v * v;
  for (const [, v] of b) bSum += v * v;
  for (const [k, vA] of a) {
    const vB = b.get(k);
    if (vB !== undefined) dot += vA * vB;
  }
  const denom = Math.sqrt(aSum) * Math.sqrt(bSum);
  return denom > 0 ? dot / denom : 0;
}

export function detectLoopRepetition(
  candidate: string,
  history: string[],
  threshold = 0.85,
): {
  /** Score máximo encontrado contra histórico (0-1). */
  maxScore: number;
  /** Se score >= threshold, indica repetição. */
  isRepetition: boolean;
  /** Índice da entrada mais similar no histórico. */
  mostSimilarIndex: number;
} {
  if (history.length === 0) {
    return { maxScore: 0, isRepetition: false, mostSimilarIndex: -1 };
  }
  const candidateVec = frequencyVector(tokenize(candidate));
  let maxScore = 0;
  let mostSimilarIndex = -1;
  for (let i = 0; i < history.length; i++) {
    const histVec = frequencyVector(tokenize(history[i]));
    const score = cosineSimilarity(candidateVec, histVec);
    if (score > maxScore) {
      maxScore = score;
      mostSimilarIndex = i;
    }
  }
  return {
    maxScore,
    isRepetition: maxScore >= threshold,
    mostSimilarIndex,
  };
}
