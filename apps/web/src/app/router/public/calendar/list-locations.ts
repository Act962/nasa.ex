import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

export const listLocations = base.handler(async () => {
  const rows = await prisma.action.findMany({
    where: {
      isPublic: true,
      isArchived: false,
      isGuestDraft: false,
      publishedAt: { not: null },
      state: { not: null },
    },
    select: { state: true, city: true },
    distinct: ["state", "city"],
  });

  const states = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.state) continue;
    if (!states.has(r.state)) states.set(r.state, new Set());
    if (r.city) states.get(r.state)!.add(r.city);
  }

  return {
    states: Array.from(states.entries()).map(([state, cities]) => ({
      state,
      cities: Array.from(cities).sort(),
    })).sort((a, b) => a.state.localeCompare(b.state)),
  };
});
