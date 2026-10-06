export const ORG_SLUG_MAX_LENGTH = 80;
export const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SEQUENTIAL_SUFFIXES = [2, 3, 4, 5];
const RANDOM_SUFFIX_COUNT = 3;
const LONGEST_SUFFIX_LENGTH = 4;

export function createSlug(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createRandomSuffix(): string {
  return String(Math.floor(100 + Math.random() * 900));
}

/** Variações de um slug já em uso: primeiro as curtas e previsíveis, depois as aleatórias. */
export function buildSlugCandidates(baseSlug: string): string[] {
  const trimmedBaseSlug = baseSlug
    .slice(0, ORG_SLUG_MAX_LENGTH - LONGEST_SUFFIX_LENGTH)
    .replace(/-+$/, "");
  const sequentialCandidates = SEQUENTIAL_SUFFIXES.map(
    (suffix) => `${trimmedBaseSlug}-${suffix}`,
  );
  const randomCandidates = Array.from(
    { length: RANDOM_SUFFIX_COUNT },
    () => `${trimmedBaseSlug}-${createRandomSuffix()}`,
  );
  return [...new Set([...sequentialCandidates, ...randomCandidates])];
}
