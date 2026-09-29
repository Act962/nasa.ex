"use client";

import { AgentsSection } from "@/features/astro/components/settings/agents-section";

/**
 * Agentes e permissões do ASTRO (spec 0028, RF-10). Traz a seção que vivia em
 * /settings/astro; as chaves `astro.*` entram na fase seguinte do roadmap.
 */
export function PermissionsTab() {
  return (
    <div className="max-w-3xl space-y-6">
      <AgentsSection />
    </div>
  );
}
