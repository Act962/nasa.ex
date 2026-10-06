export const ORG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SEQUENTIAL_SUFFIXES = [2, 3, 4, 5];
const RANDOM_SUFFIX_COUNT = 3;

export function createSlug(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
  const sequentialCandidates = SEQUENTIAL_SUFFIXES.map((suffix) => `${baseSlug}-${suffix}`);
  const randomCandidates = Array.from(
    { length: RANDOM_SUFFIX_COUNT },
    () => `${baseSlug}-${createRandomSuffix()}`,
  );
  return [...new Set([...sequentialCandidates, ...randomCandidates])];
}
