import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getMemberActivityReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      memberIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      const fromDate = input.from
        ? new Date(input.from)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = input.to ? new Date(input.to) : new Date();

      const memberFilter =
        input.memberIds && input.memberIds.length > 0
          ? { userId: { in: input.memberIds } }
          : {};

      const members = await prisma.member.findMany({
        where: {
          organizationId: org.id,
          ...memberFilter,
        },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });

      const memberUserIds = members.map((m) => m.userId);
      if (memberUserIds.length === 0) {
        return {
          totalMembers: 0,
          members: [],
          orgTotals: {
            avgPlatformTimeMs: 0,
            mostUsedApp: null,
            starsConsumed: 0,
            totalSpacePoints: 0,
          },
        };
      }

      const [logs, spacePoints, starTransactions] = await Promise.all([
        prisma.systemActivityLog.findMany({
          where: {
            organizationId: org.id,
            userId: { in: memberUserIds },
            createdAt: { gte: fromDate, lte: toDate },
          },
          select: {
            userId: true,
            appSlug: true,
            durationMs: true,
            createdAt: true,
          },
        }),
        prisma.userSpacePoint.findMany({
          where: { orgId: org.id, userId: { in: memberUserIds } },
          select: { userId: true, totalPoints: true, weeklyPoints: true },
        }),
        prisma.starTransaction.findMany({
          where: {
            organizationId: org.id,
            amount: { lt: 0 },
            createdAt: { gte: fromDate, lte: toDate },
          },
          select: { amount: true, appSlug: true, createdAt: true },
        }),
      ]);

      const orgStarsConsumed = starTransactions.reduce(
        (s, t) => s + Math.abs(t.amount),
        0,
      );
      const memberCount = members.length;
      const orgStarsApprox = memberCount > 0 ? orgStarsConsumed / memberCount : 0;

      const reports = members.map((m) => {
        const userLogs = logs.filter((l) => l.userId === m.userId);

        const totalTimeMs = userLogs.reduce(
          (s, l) => s + (l.durationMs ?? 0),
          0,
        );
        const sessionCount = userLogs.filter(
          (l) => (l.durationMs ?? 0) > 0,
        ).length;
        const avgSessionMs =
          sessionCount > 0 ? totalTimeMs / sessionCount : 0;

        const appCounts = new Map<string, { count: number; durationMs: number }>();
        for (const log of userLogs) {
          const existing = appCounts.get(log.appSlug);
          if (existing) {
            existing.count++;
            existing.durationMs += log.durationMs ?? 0;
          } else {
            appCounts.set(log.appSlug, {
              count: 1,
              durationMs: log.durationMs ?? 0,
            });
          }
        }
        const mostUsedApp = Array.from(appCounts.entries())
          .sort((a, b) => b[1].count - a[1].count)[0];
        const appBreakdown = Array.from(appCounts.entries())
          .map(([slug, data]) => ({
            appSlug: slug,
            count: data.count,
            durationMs: data.durationMs,
          }))
          .sort((a, b) => b.count - a.count);

        const hourCounts = new Array(24).fill(0);
        for (const log of userLogs) {
          hourCounts[log.createdAt.getHours()]++;
        }
        const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
        const hourlyDistribution = hourCounts.map((count, hour) => ({
          hour,
          count,
        }));

        const sp = spacePoints.find((s) => s.userId === m.userId);

        return {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          role: m.role,
          totals: {
            totalTimeMs,
            avgSessionMs,
            totalActions: userLogs.length,
            mostUsedApp: mostUsedApp ? mostUsedApp[0] : null,
            mostUsedAppCount: mostUsedApp ? mostUsedApp[1].count : 0,
            spacePoints: sp?.totalPoints ?? 0,
            weeklyPoints: sp?.weeklyPoints ?? 0,
            starsConsumed: Math.round(orgStarsApprox),
            peakHour,
          },
          appBreakdown,
          hourlyDistribution,
        };
      });

      const sorted = reports.sort(
        (a, b) => b.totals.totalActions - a.totals.totalActions,
      );

      const orgTotalTime = logs.reduce((s, l) => s + (l.durationMs ?? 0), 0);
      const orgAvgTime =
        memberCount > 0 ? orgTotalTime / memberCount : 0;
      const orgAppCounts = new Map<string, number>();
      for (const log of logs) {
        orgAppCounts.set(log.appSlug, (orgAppCounts.get(log.appSlug) ?? 0) + 1);
      }
      const orgMostUsed = Array.from(orgAppCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0];
      const totalSpacePoints = spacePoints.reduce(
        (s, sp) => s + sp.totalPoints,
        0,
      );

      return {
        totalMembers: memberCount,
        members: sorted,
        orgTotals: {
          avgPlatformTimeMs: orgAvgTime,
          mostUsedApp: orgMostUsed ? orgMostUsed[0] : null,
          starsConsumed: orgStarsConsumed,
          totalSpacePoints,
        },
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
