// Camadas entre features (regra R11, docs/architecture/target-state.md A2).
// Uma feature só pode importar features da própria camada ou de camadas abaixo.
// Feature que não aparece aqui é "domain".

export type FeatureTier = "kernel" | "domain" | "orchestrator";

export const TIER_RANK: Record<FeatureTier, number> = {
  kernel: 0,
  domain: 1,
  orchestrator: 2,
};

const KERNEL_FEATURES = ["tour", "astro-guides", "stars", "tags", "space-point", "alerts"];

const ORCHESTRATOR_FEATURES = ["astro", "astro-commander", "nasa-command", "admin", "insights"];

export function tierOf(featureName: string): FeatureTier {
  if (KERNEL_FEATURES.includes(featureName)) return "kernel";
  if (ORCHESTRATOR_FEATURES.includes(featureName)) return "orchestrator";
  return "domain";
}
