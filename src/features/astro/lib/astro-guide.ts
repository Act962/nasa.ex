import type { GuideDef } from "@/features/astro-guides/lib/types";

// Cartão "Me mostre na tela" (spec 0046, RF-7).

export interface AstroGuidePayload {
  kind: "astro_guide";
  guideKey: string;
  title: string;
  summary: string;
  stepCount: number;
}

export function toAstroGuidePayload(guide: GuideDef): AstroGuidePayload {
  return {
    kind: "astro_guide",
    guideKey: guide.key,
    title: guide.title,
    summary: guide.summary,
    stepCount: guide.steps.length,
  };
}

export function isAstroGuidePayload(value: unknown): value is AstroGuidePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: string }).kind === "astro_guide" &&
    typeof (value as { guideKey?: unknown }).guideKey === "string"
  );
}
