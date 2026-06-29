import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { EVENT_CATEGORIES } from "@/features/public-calendar/utils/categories";

export const listCategories = base.handler(async () => {
  const grouped = await prisma.action.groupBy({
    by: ["eventCategory"],
    where: {
      isPublic: true,
      isArchived: false,
      isGuestDraft: false,
      publishedAt: { not: null },
    },
    _count: { _all: true },
  });

  const countMap = new Map(
    grouped.map((g) => [g.eventCategory ?? "OUTRO", g._count._all]),
  );

  return {
    categories: EVENT_CATEGORIES.map((c) => ({
      value: c.value,
      label: c.label,
      emoji: c.emoji,
      count: countMap.get(c.value) ?? 0,
    })),
  };
});
