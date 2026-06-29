import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

export const getStats = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    period:  z.enum(["7d", "30d", "90d"]).default("30d"),
    appSlug: z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    const currentMember = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
    });
    if (!currentMember || currentMember.role === "member") {
      throw new ORPCError("FORBIDDEN", { message: "Sem permissão" });
    }

    const days = input.period === "7d" ? 7 : input.period === "30d" ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: any = { organizationId: orgId, createdAt: { gte: startDate } };
    if (input.appSlug) where.appSlug = input.appSlug;

    // Get all members
    const members = await prisma.member.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    // Group logs by userId + day
    const logs = await prisma.systemActivityLog.findMany({
      where,
      select: { userId: true, userName: true, userEmail: true, userImage: true, appSlug: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Per-member totals
    const memberTotals: Record<string, { userId: string; name: string; email: string; image: string | null; total: number; byApp: Record<string, number> }> = {};

    for (const m of members) {
      memberTotals[m.userId] = {
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image ?? null,
        total: 0,
        byApp: {},
      };
    }

    for (const log of logs) {
      if (!memberTotals[log.userId]) {
        memberTotals[log.userId] = {
          userId: log.userId,
          name: log.userName,
          email: log.userEmail,
          image: log.userImage ?? null,
          total: 0,
          byApp: {},
        };
      }
      memberTotals[log.userId].total++;
      memberTotals[log.userId].byApp[log.appSlug] = (memberTotals[log.userId].byApp[log.appSlug] ?? 0) + 1;
    }

    // Timeline: group by day
    const dayMap: Record<string, Record<string, number>> = {}; // day → userId → count
    for (const log of logs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = {};
      dayMap[day][log.userId] = (dayMap[day][log.userId] ?? 0) + 1;
    }

    const timelineData = Object.entries(dayMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      memberTotals: Object.values(memberTotals).sort((a, b) => b.total - a.total),
      timelineData,
      members: members.map((m) => ({ id: m.userId, name: m.user.name, email: m.user.email, image: m.user.image ?? null, role: m.role })),
    };
  });
