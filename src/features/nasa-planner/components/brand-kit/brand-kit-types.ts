import type { usePlannerBrandKit } from "../../hooks/use-planner-brand-kit";

export type PlannerBrandKit = NonNullable<ReturnType<typeof usePlannerBrandKit>["brandKit"]>;
export type PlannerBrandKitAsset = PlannerBrandKit["assets"][number];
