// Space Help suggester — match a user query against Space Help content
// Returns ranked feature/track suggestions for Astro to render as rich cards.

export interface SuggesterFeature {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  youtubeUrl: string | null;
  category: { slug: string; name: string };
  firstStepScreenshotUrl?: string | null;
  stepCount?: number;
}

export interface SuggesterTrack {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverUrl: string | null;
  rewardStars: number;
  rewardSpacePoints: number;
  lessonCount?: number;
}

export interface SpaceHelpResource {
  kind: "feature" | "track";
  title: string;
  summary: string | null;
  categoryName?: string;
  url: string;
  screenshotUrl?: string | null;
  youtubeUrl?: string | null;
  stepCount?: number;
  lessonCount?: number;
  rewardStars?: number;
  rewardSpacePoints?: number;
}

const STOPWORDS = new Set([
  "a", "o", "e", "de", "da", "do", "em", "no", "na", "para", "por", "que",
  "como", "qual", "quais", "onde", "quando", "com", "um", "uma", "os", "as",
  "dos", "das", "se", "é", "ser", "estar", "ter", "fazer", "pra", "pro",
  "the", "of", "to", "for", "in", "on", "at", "is", "are", "and", "or",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function scoreText(queryTokens: string[], text: string, weight: number): number {
  if (!text) return 0;
  const norm = normalize(text);
  let score = 0;
  for (const t of queryTokens) {
    if (norm.includes(t)) score += weight;
  }
  return score;
}

export function suggestSpaceHelp(
  query: string,
  features: SuggesterFeature[],
  tracks: SuggesterTrack[],
  limit = 3,
): SpaceHelpResource[] {
  const qTokens = tokens(query);
  if (qTokens.length === 0) return [];

  const scored: Array<{ score: number; resource: SpaceHelpResource }> = [];

  for (const f of features) {
    let score = 0;
    score += scoreText(qTokens, f.title, 4);
    score += scoreText(qTokens, f.slug, 3);
    score += scoreText(qTokens, f.summary ?? "", 2);
    score += scoreText(qTokens, f.category.name, 2);
    score += scoreText(qTokens, f.category.slug, 2);
    if (score > 0) {
      scored.push({
        score,
        resource: {
          kind: "feature",
          title: f.title,
          summary: f.summary,
          categoryName: f.category.name,
          url: `/space-help/${f.category.slug}/${f.slug}`,
          screenshotUrl: f.firstStepScreenshotUrl ?? null,
          youtubeUrl: f.youtubeUrl,
          stepCount: f.stepCount,
        },
      });
    }
  }

  for (const t of tracks) {
    let score = 0;
    score += scoreText(qTokens, t.title, 4);
    score += scoreText(qTokens, t.slug, 3);
    score += scoreText(qTokens, t.subtitle ?? "", 2);
    score += scoreText(qTokens, t.description ?? "", 1);
    if (score > 0) {
      scored.push({
        score: score + 0.5,
        resource: {
          kind: "track",
          title: t.title,
          summary: t.subtitle ?? t.description,
          url: `/space-help/trilhas/${t.slug}`,
          screenshotUrl: t.coverUrl,
          lessonCount: t.lessonCount,
          rewardStars: t.rewardStars,
          rewardSpacePoints: t.rewardSpacePoints,
        },
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.resource);
}
