"use client";

import { creativeReviewSchema } from "@/features/trafego/lib/creative-review/schema";
import { CreativeReviewResult } from "@/features/trafego/components/panel/creative-review/creative-review-result";

/** A análise do Astro guardada no criativo, para a equipe usar ao publicar (spec 0126, RF-15). */
export function StoredCreativeReview({ raw }: { raw: unknown }) {
  const parsed = creativeReviewSchema.safeParse(raw);
  if (!parsed.success) return null;
  return <CreativeReviewResult review={parsed.data} className="m-3 mt-0" />;
}
