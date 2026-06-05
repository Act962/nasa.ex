/**
 * Algoritmo de match fuzzy reusado entre import preview (sugestões auto)
 * e find-or-create de tags. Cópia conservadora do que está em
 * `agent-presets/find-or-create-tags.ts` — promovido pra cá pra evitar
 * import cross-feature pesado.
 */

/**
 * Score de similaridade pelo Jaccard nos tokens normalizados.
 * Retorna [0, 1]. ≥ 0.7 = match forte.
 */
export function similarityScore(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  return jaccard(ta, tb);
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Acha melhor match em uma lista de candidatos pelo (slug exato OR
 * Jaccard nos nomes). Retorna `null` se score < threshold.
 */
export function findBestMatch(
  needle: { slug: string; label: string },
  candidates: Array<{ id: string; slug?: string | null; name: string }>,
  threshold = 0.5,
): { id: string; label: string; score: number; matchedBy: "slug" | "name" } | null {
  // 1. Slug exato
  if (needle.slug) {
    const exact = candidates.find(
      (c) => c.slug && c.slug.toLowerCase() === needle.slug.toLowerCase(),
    );
    if (exact) {
      return {
        id: exact.id,
        label: exact.name,
        score: 1,
        matchedBy: "slug",
      };
    }
  }

  // 2. Jaccard no name
  let best: { id: string; label: string; score: number; matchedBy: "name" } | null = null;
  for (const cand of candidates) {
    const score = similarityScore(needle.label, cand.name);
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: cand.id, label: cand.name, score, matchedBy: "name" };
    }
  }
  return best;
}

/**
 * Top N alternativas — pra UI mostrar "outras opções" quando o auto-match
 * não é ideal.
 */
export function topAlternatives(
  needle: { slug: string; label: string },
  candidates: Array<{ id: string; slug?: string | null; name: string }>,
  n = 3,
  excludeId?: string,
): Array<{ id: string; label: string; score: number }> {
  const scored = candidates
    .filter((c) => c.id !== excludeId)
    .map((c) => ({
      id: c.id,
      label: c.name,
      score: similarityScore(needle.label, c.name),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}
