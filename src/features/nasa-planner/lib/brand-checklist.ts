import type { NasaPlannerPostType } from "@/generated/prisma/enums";

/** Checklist de marca do conteúdo (spec 0058, RF-4): o que dá para conferir sozinho a partir do brand kit, e o que o revisor confere. */

export type BrandCheckStatus = "ok" | "warn" | "manual";

export interface BrandCheckItem {
  id: string;
  label: string;
  status: BrandCheckStatus;
  detail?: string;
}

interface ChecklistPost {
  type: NasaPlannerPostType;
  caption: string | null;
  hashtags: string[];
  title: string | null;
}

interface ChecklistBrandKit {
  forbiddenWords: string[];
  defaultHashtags: string[];
}

const MAX_HASHTAGS = 30;

export function buildBrandChecklist(post: ChecklistPost, brandKit: ChecklistBrandKit | null): BrandCheckItem[] {
  const text = `${post.title ?? ""} ${post.caption ?? ""}`.toLowerCase();
  const foundForbiddenWords = (brandKit?.forbiddenWords ?? []).filter((word) => word.trim() && text.includes(word.trim().toLowerCase()));
  const hashtagCount = post.hashtags.length + ((post.caption ?? "").match(/#\w+/g) ?? []).length;
  const items: BrandCheckItem[] = [
    {
      id: "forbidden-words",
      label: "Nenhuma palavra proibida da marca",
      status: foundForbiddenWords.length > 0 ? "warn" : "ok",
      detail: foundForbiddenWords.length > 0 ? `Encontrado: ${foundForbiddenWords.join(", ")}` : undefined,
    },
    {
      id: "hashtags",
      label: `Até ${MAX_HASHTAGS} hashtags`,
      status: hashtagCount > MAX_HASHTAGS ? "warn" : "ok",
      detail: `${hashtagCount} no post`,
    },
    { id: "logo", label: "Logo da marca presente", status: "manual" },
    { id: "colors", label: "Cores da paleta da marca", status: "manual" },
    { id: "tone", label: "Tom de voz da marca", status: "manual" },
  ];
  if (post.type === "STORY") {
    items.push({ id: "story-text", label: "Story não mostra legenda: o texto precisa estar na arte", status: post.caption ? "warn" : "ok" });
  }
  if (post.type === "REEL" || post.type === "STORY") {
    items.push({ id: "vertical", label: "Formato vertical 9:16", status: "manual" });
  }
  return items;
}
