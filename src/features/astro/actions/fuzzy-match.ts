// Nome com erro de digitação ("Agenda Comerical") vira sugestão em vez de
// "não achei" (spec 0033, RF-2). Comparação em código, sem pg_trgm (D-2).

const MAX_EDITS_PER_WORD = 2;
const MIN_SCORE = 0.5;

function normalizeName(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

function editDistance(source: string, target: string): number {
  const previousRow = Array.from({ length: target.length + 1 }, (_, index) => index);
  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex++) {
    let diagonal = previousRow[0];
    previousRow[0] = sourceIndex;
    for (let targetIndex = 1; targetIndex <= target.length; targetIndex++) {
      const above = previousRow[targetIndex];
      previousRow[targetIndex] = Math.min(
        above + 1,
        previousRow[targetIndex - 1] + 1,
        diagonal + (source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previousRow[target.length];
}

/** Quanto cada palavra digitada casa com alguma palavra do nome (0 a 1). */
function similarityScore(typed: string, candidate: string): number {
  const typedWords = normalizeName(typed);
  const candidateWords = normalizeName(candidate);
  if (typedWords.length === 0 || candidateWords.length === 0) return 0;

  const wordScores = typedWords.map((typedWord) => {
    let bestScore = 0;
    for (const candidateWord of candidateWords) {
      if (candidateWord.startsWith(typedWord) || typedWord.startsWith(candidateWord)) {
        bestScore = Math.max(bestScore, 1);
        continue;
      }
      const edits = editDistance(typedWord, candidateWord);
      if (edits <= MAX_EDITS_PER_WORD && typedWord.length >= 4) {
        bestScore = Math.max(bestScore, 1 - edits / Math.max(typedWord.length, candidateWord.length));
      }
    }
    return bestScore;
  });
  return wordScores.reduce((total, score) => total + score, 0) / typedWords.length;
}

/** Candidatos parecidos com o que foi digitado, do mais parecido ao menos. */
export function rankBySimilarity<Candidate extends { name: string }>(
  typed: string,
  candidates: Candidate[],
  limit = 8,
): Candidate[] {
  return candidates
    .map((candidate) => ({ candidate, score: similarityScore(typed, candidate.name) }))
    .filter((scored) => scored.score >= MIN_SCORE)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((scored) => scored.candidate);
}
