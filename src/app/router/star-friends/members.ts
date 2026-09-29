import { z } from "zod";
import prisma from "@/lib/prisma";
import { getBalancesForMembers } from "@/features/star-friends/lib/members";
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
    const balances = await getBalancesForMembers(page.map((member) => member.id));
    return {
      members: page.map((member) => ({
        id: member.id,
        name: member.name,
        phone: member.phone,
        lastLeadId: member.lastLeadId,
        balance: balances.get(member.id) ?? 0,
        joinedAt: member.createdAt,
      })),
      nextCursor: members.length > MEMBERS_PAGE_SIZE ? page[page.length - 1]?.id : null,
    };
  });
