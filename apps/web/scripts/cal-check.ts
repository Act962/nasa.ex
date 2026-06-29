import "dotenv/config";
import prisma from "../src/lib/prisma";

(async () => {
  const now = new Date();
  const all = await prisma.action.count();
  const matching = await prisma.action.count({
    where: { isPublic: true, isArchived: false, isGuestDraft: false, publishedAt: { not: null, lte: now } },
  });
  const sample = await prisma.action.findMany({
    where: { isPublic: true },
    take: 3,
    select: { id: true, title: true, isPublic: true, isArchived: true, isGuestDraft: true, publishedAt: true, startDate: true, eventCategory: true, country: true, state: true, city: true },
  });
  console.log("Total Action rows:", all);
  console.log("Matching listPublic where:", matching);
  console.log("Sample isPublic=true:", JSON.stringify(sample, null, 2));
  await prisma.$disconnect();
})();
