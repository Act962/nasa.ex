"use client";

import { KnowledgeSection } from "@/features/astro-commander/components/intelligence/knowledge-section";
import { MemoriesSection } from "@/features/astro-commander/components/intelligence/memories-section";
import { FeedbackSection } from "@/features/astro-commander/components/intelligence/feedback-section";

/**
 * Auto Inteligência (spec 0028, RF-13 a RF-16): o que o ASTRO sabe da empresa,
 * as regras que ele nunca contorna e o que ele aprende com as correções.
 */
export function AutoIntelligenceTab() {
  return (
    <div className="max-w-3xl space-y-10">
      <KnowledgeSection />
      <div className="border-t pt-10">
        <MemoriesSection />
      </div>
      <div className="border-t pt-10">
        <FeedbackSection />
      </div>
    </div>
  );
}
