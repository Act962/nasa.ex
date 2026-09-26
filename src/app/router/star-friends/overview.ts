import { z } from "zod";
import prisma from "@/lib/prisma";
import { isStarFriendsInstalled } from "@/features/star-friends/lib/program";
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
    return {
      isInstalled,
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
