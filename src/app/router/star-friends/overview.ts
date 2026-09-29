import { z } from "zod";
import prisma from "@/lib/prisma";
import { isStarFriendsInstalled } from "@/features/star-friends/lib/program";
import { lifetimeStarsFrom, resolveTier, type LoyaltyTierId } from "@/features/star-friends/utils/tiers";

// Painel da Visão geral: poucas linhas recentes, o resto fica na aba Histórico.
const RECENT_ENTRIES = 6;

async function countMembersByTier(organizationId: string, thresholds: { moonMinStars: number; galaxyMinStars: number }) {
  const grouped = await prisma.loyaltyLedgerEntry.groupBy({
    by: ["memberId", "type"],
    where: { organizationId },
    _sum: { stars: true },
  });
  const entriesByMember = new Map<string, { type: string; stars: number }[]>();
  for (const row of grouped) {
    const entries = entriesByMember.get(row.memberId) ?? [];
    entries.push({ type: row.type, stars: row._sum.stars ?? 0 });
    entriesByMember.set(row.memberId, entries);
  }
  const counts: Record<LoyaltyTierId, number> = { EARTH: 0, MOON: 0, GALAXY: 0 };
  const membersCount = await prisma.loyaltyMember.count({ where: { organizationId } });
  for (const entries of entriesByMember.values()) counts[resolveTier(lifetimeStarsFrom(entries), thresholds)] += 1;
  // Membro sem lançamento nenhum ainda é Terra.
  counts.EARTH += Math.max(0, membersCount - entriesByMember.size);
  return counts;
}
import { starFriendsWith } from "./_base";

export const getStarFriendsOverview = starFriendsWith("canView")
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const organizationId = context.org.id;
    const [isInstalled, program, membersCount, circulation, pendingCount, deliveredCount] =
      await Promise.all([
        isStarFriendsInstalled(organizationId),
        prisma.loyaltyProgram.findUnique({ where: { organizationId } }),
        prisma.loyaltyMember.count({ where: { organizationId } }),
        prisma.loyaltyLedgerEntry.aggregate({ where: { organizationId }, _sum: { stars: true } }),
        prisma.loyaltyRedemption.count({ where: { organizationId, status: "PENDING" } }),
        prisma.loyaltyRedemption.count({ where: { organizationId, status: "DELIVERED" } }),
      ]);
    const [tierCounts, recentEntries, deliveredByReward] = program
      ? await Promise.all([
          countMembersByTier(organizationId, program),
          prisma.loyaltyLedgerEntry.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            take: RECENT_ENTRIES,
            select: {
              id: true,
              type: true,
              stars: true,
              itemsSnapshot: true,
              reason: true,
              createdAt: true,
              member: { select: { name: true } },
            },
          }),
          prisma.loyaltyRedemption.groupBy({
            by: ["rewardId"],
            where: { organizationId, status: "DELIVERED" },
            _count: { _all: true },
          }),
        ])
      : [null, [], []];
    return {
      isInstalled,
      tierCounts,
      recentEntries: recentEntries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        stars: entry.stars,
        itemsSnapshot: entry.itemsSnapshot,
        reason: entry.reason,
        createdAt: entry.createdAt,
        memberName: entry.member.name,
      })),
      deliveredByReward: Object.fromEntries(deliveredByReward.map((row) => [row.rewardId, row._count._all])),
      program: program
        ? {
            isActive: program.isActive,
            name: program.name,
            starsPerPurchase: program.starsPerPurchase,
            minPurchaseAmount: Number(program.minPurchaseAmount),
            starsExpireDays: program.starsExpireDays,
            countCatalogOrders: program.countCatalogOrders,
            countForgeProposals: program.countForgeProposals,
            rules: program.rules,
            moonMinStars: program.moonMinStars,
            galaxyMinStars: program.galaxyMinStars,
            earthPerks: program.earthPerks,
            moonPerks: program.moonPerks,
            galaxyPerks: program.galaxyPerks,
          }
        : null,
      stats: {
        membersCount,
        starsInCirculation: circulation._sum.stars ?? 0,
        pendingRedemptions: pendingCount,
        deliveredRedemptions: deliveredCount,
      },
    };
  });
