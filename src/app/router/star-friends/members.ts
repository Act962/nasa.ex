import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  getBalancesForMembers,
  getLastActivityForMembers,
  getLifetimeStarsForMembers,
} from "@/features/star-friends/lib/members";
import { resolveTier } from "@/features/star-friends/utils/tiers";
import { starFriendsWith } from "./_base";

const MEMBERS_PAGE_SIZE = 30;

export const listStarFriendsMembers = starFriendsWith("canView")
  .input(z.object({ search: z.string().optional(), cursor: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const search = input.search?.trim();
    const members = await prisma.loyaltyMember.findMany({
      where: {
        organizationId: context.org.id,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search.replace(/\D/g, "") || search } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: MEMBERS_PAGE_SIZE + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const page = members.slice(0, MEMBERS_PAGE_SIZE);
    const memberIds = page.map((member) => member.id);
    const [balances, lifetimeStarsByMember, lastActivityByMember, program] = await Promise.all([
      getBalancesForMembers(memberIds),
      getLifetimeStarsForMembers(memberIds),
      getLastActivityForMembers(memberIds),
      prisma.loyaltyProgram.findUnique({
        where: { organizationId: context.org.id },
        select: { moonMinStars: true, galaxyMinStars: true },
      }),
    ]);
    return {
      members: page.map((member) => ({
        id: member.id,
        name: member.name,
        phone: member.phone,
        lastLeadId: member.lastLeadId,
        balance: balances.get(member.id) ?? 0,
        joinedAt: member.createdAt,
        tier: program ? resolveTier(lifetimeStarsByMember.get(member.id) ?? 0, program) : null,
        lastActivityAt: lastActivityByMember.get(member.id) ?? null,
      })),
      nextCursor: members.length > MEMBERS_PAGE_SIZE ? page[page.length - 1]?.id : null,
    };
  });
