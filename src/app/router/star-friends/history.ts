import { z } from "zod";
import prisma from "@/lib/prisma";
import { starFriendsWith } from "./_base";

const HISTORY_PAGE_SIZE = 50;
const HISTORY_EXPORT_LIMIT = 5000;

const historyFilters = z.object({
  memberId: z.string().optional(),
  leadId: z.string().optional(),
  actorUserId: z.string().optional(),
  type: z.enum(["EARN", "REDEEM", "ADJUST_CREDIT", "ADJUST_DEBIT", "EXPIRE", "REVERSAL"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function buildHistoryWhere(organizationId: string, filters: z.infer<typeof historyFilters>) {
  return {
    organizationId,
    ...(filters.memberId ? { memberId: filters.memberId } : {}),
    ...(filters.leadId ? { leadId: filters.leadId } : {}),
    ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };
}

const entrySelect = {
  id: true,
  type: true,
  stars: true,
  source: true,
  sourceId: true,
  itemsSnapshot: true,
  reason: true,
  actorType: true,
  actorUserId: true,
  actorName: true,
  leadId: true,
  expiresAt: true,
  createdAt: true,
  member: { select: { id: true, name: true, phone: true } },
} as const;

// Auditoria: cada linha diz quem (usuário, sistema, Astro ou cliente), quando,
// quanto e o que foi comprado/trocado.
export const listStarFriendsHistory = starFriendsWith("canView")
  .input(historyFilters.extend({ cursor: z.string().optional(), exportAll: z.boolean().optional() }))
  .handler(async ({ input, context }) => {
    const pageSize = input.exportAll ? HISTORY_EXPORT_LIMIT : HISTORY_PAGE_SIZE;
    const entries = await prisma.loyaltyLedgerEntry.findMany({
      where: buildHistoryWhere(context.org.id, input),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: entrySelect,
    });
    const page = entries.slice(0, pageSize);
    const actors = await prisma.loyaltyLedgerEntry.findMany({
      where: { organizationId: context.org.id, actorUserId: { not: null } },
      distinct: ["actorUserId"],
      select: { actorUserId: true, actorName: true },
    });
    return {
      entries: page,
      nextCursor: entries.length > pageSize ? page[page.length - 1]?.id : null,
      actors: actors.map((actor) => ({ userId: actor.actorUserId as string, name: actor.actorName })),
    };
  });
