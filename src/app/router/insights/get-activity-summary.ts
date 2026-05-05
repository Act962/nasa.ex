import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getActivitySummary = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      orgIds: z.array(z.string()).optional(),
      userIds: z.array(z.string()).optional(),
      appSlugs: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const memberships = await prisma.member.findMany({
      where: { userId: context.user.id },
      select: { organizationId: true, role: true },
    });
    const myOrgIds = memberships.map((m) => m.organizationId);
    const requestedOrgs = (input.orgIds && input.orgIds.length > 0)
      ? input.orgIds.filter((id) => myOrgIds.includes(id))
      : myOrgIds;

    if (requestedOrgs.length === 0) {
      return {
        totalActiveSec: 0,
        totalOnlineSec: 0,
        totalInactiveSec: 0,
        spacePointsEarned: 0,
        starsConsumed: 0,
        byUser: [],
        byApp: [],
      };
    }

    const isMemberOnly = memberships.every((m) => m.role === "member");
    const userFilter = isMemberOnly ? [context.user.id] : input.userIds;

    const from = input.from ? new Date(input.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = input.to ? new Date(input.to) : new Date();

    const where: any = {
      organizationId: { in: requestedOrgs },
      createdAt: { gte: from, lte: to },
    };
    if (userFilter && userFilter.length > 0) where.userId = { in: userFilter };
    if (input.appSlugs && input.appSlugs.length > 0) where.appSlug = { in: input.appSlugs };

    const [logs, presence, stars, spTransactions] = await Promise.all([
      prisma.systemActivityLog.findMany({
        where,
        select: {
          userId: true,
          userName: true,
          userImage: true,
          appSlug: true,
          action: true,
          createdAt: true,
          durationMs: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.userPresence.findMany({
        where: { organizationId: { in: requestedOrgs } },
        select: {
          userId: true,
          lastSeenAt: true,
          activeAppSlug: true,
          activePath: true,
          activeResource: true,
        },
      }),
      prisma.starTransaction.findMany({
        where: {
          organizationId: { in: requestedOrgs },
          amount: { lt: 0 },
          createdAt: { gte: from, lte: to },
        },
        select: { amount: true, appSlug: true },
      }),
      prisma.spacePointTransaction.findMany({
        where: {
          orgId: { in: requestedOrgs },
          createdAt: { gte: from, lte: to },
        },
        select: { points: true, userPoint: { select: { userId: true } } },
      }),
    ]);

    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    // ── Cálculo de "Tempo ativo" via janelas de log ───────────────────────────
    // Cada log gera uma janela [t, t+SESSION_WINDOW_MS]. Janelas sobrepostas são
    // mescladas (mesma sessão). A soma das janelas mescladas vira o tempo ativo.
    // Funciona mesmo sem `durationMs` (que raramente é preenchido hoje).
    const SESSION_WINDOW_MS = 5 * 60 * 1000;

    function sumMergedWindows(timestamps: number[], explicitDurations: number[]): number {
      if (timestamps.length === 0) return 0;
      const items = timestamps
        .map((t, i) => ({ t, d: explicitDurations[i] ?? 0 }))
        .sort((a, b) => a.t - b.t);
      let total = 0;
      let winStart = items[0].t;
      let winEnd = items[0].t + Math.max(SESSION_WINDOW_MS, items[0].d);
      for (let i = 1; i < items.length; i++) {
        const t = items[i].t;
        const end = t + Math.max(SESSION_WINDOW_MS, items[i].d);
        if (t <= winEnd) {
          winEnd = Math.max(winEnd, end);
        } else {
          total += winEnd - winStart;
          winStart = t;
          winEnd = end;
        }
      }
      total += winEnd - winStart;
      return total;
    }

    const byUser: Record<string, {
      userId: string;
      name: string;
      image: string | null;
      actions: number;
      activeMs: number;
      inactiveMs: number;
      isOnlineNow: boolean;
      currentActivity: { appSlug: string | null; path: string | null; resource: string | null } | null;
      spacePoints: number;
      byApp: Record<string, { actions: number; activeMs: number; _times: number[]; _durs: number[] }>;
      _times: number[];
      _durs: number[];
    }> = {};

    let totalInactiveMs = 0;

    for (const log of logs) {
      if (!byUser[log.userId]) {
        byUser[log.userId] = {
          userId: log.userId,
          name: log.userName,
          image: log.userImage ?? null,
          actions: 0,
          activeMs: 0,
          inactiveMs: 0,
          isOnlineNow: false,
          currentActivity: null,
          spacePoints: 0,
          byApp: {},
          _times: [],
          _durs: [],
        };
      }
      const u = byUser[log.userId];

      // Logs de inatividade (aba em segundo plano) somam tempo inativo, mas não
      // contam como "ação", não entram em sumMergedWindows e não inflam o
      // breakdown por app.
      if (log.action === "tab.hidden") {
        const dur = log.durationMs ?? 0;
        u.inactiveMs += dur;
        totalInactiveMs += dur;
        continue;
      }

      u.actions++;
      const ts = log.createdAt.getTime();
      const dur = log.durationMs ?? 0;
      u._times.push(ts);
      u._durs.push(dur);
      if (!u.byApp[log.appSlug]) u.byApp[log.appSlug] = { actions: 0, activeMs: 0, _times: [], _durs: [] };
      u.byApp[log.appSlug].actions++;
      u.byApp[log.appSlug]._times.push(ts);
      u.byApp[log.appSlug]._durs.push(dur);
    }

    // Computa janelas mescladas por usuário e por app
    for (const userId in byUser) {
      const u = byUser[userId];
      u.activeMs = sumMergedWindows(u._times, u._durs);
      for (const slug in u.byApp) {
        const ba = u.byApp[slug];
        ba.activeMs = sumMergedWindows(ba._times, ba._durs);
      }
    }

    for (const p of presence) {
      const last = p.lastSeenAt.getTime();
      const isOnline = last >= fiveMinAgo;
      if (byUser[p.userId]) {
        byUser[p.userId].isOnlineNow = byUser[p.userId].isOnlineNow || isOnline;
        if (isOnline) {
          byUser[p.userId].currentActivity = {
            appSlug: p.activeAppSlug,
            path: p.activePath,
            resource: p.activeResource,
          };
        }
      }
    }

    for (const sp of spTransactions) {
      const userId = sp.userPoint?.userId;
      if (userId && byUser[userId]) byUser[userId].spacePoints += sp.points;
    }

    const byAppMap: Record<string, { actions: number; activeMs: number; users: Set<string>; _times: number[]; _durs: number[] }> = {};
    for (const log of logs) {
      // Pular tab.hidden — inatividade não pertence a um app específico.
      if (log.action === "tab.hidden") continue;
      if (!byAppMap[log.appSlug]) byAppMap[log.appSlug] = { actions: 0, activeMs: 0, users: new Set(), _times: [], _durs: [] };
      byAppMap[log.appSlug].actions++;
      byAppMap[log.appSlug]._times.push(log.createdAt.getTime());
      byAppMap[log.appSlug]._durs.push(log.durationMs ?? 0);
      byAppMap[log.appSlug].users.add(log.userId);
    }
    for (const slug in byAppMap) {
      byAppMap[slug].activeMs = sumMergedWindows(byAppMap[slug]._times, byAppMap[slug]._durs);
    }

    const totalActiveMs = Object.values(byUser).reduce((s, u) => s + u.activeMs, 0);

    return {
      totalActiveSec: Math.round(totalActiveMs / 1000),
      totalOnlineSec: Math.round(totalActiveMs / 1000),
      totalInactiveSec: Math.round(totalInactiveMs / 1000),
      spacePointsEarned: spTransactions.reduce((s, t) => s + t.points, 0),
      starsConsumed: stars.reduce((s, t) => s + Math.abs(t.amount), 0),
      byUser: Object.values(byUser)
        .map((u) => {
          const { _times, _durs, byApp, ...rest } = u as any;
          const cleanByApp: Record<string, { actions: number; activeMs: number }> = {};
          for (const slug in byApp) {
            cleanByApp[slug] = { actions: byApp[slug].actions, activeMs: byApp[slug].activeMs };
          }
          return { ...rest, byApp: cleanByApp };
        })
        .sort((a: any, b: any) => b.actions - a.actions),
      byApp: Object.entries(byAppMap)
        .map(([slug, v]) => ({
          appSlug: slug,
          actions: v.actions,
          activeMs: v.activeMs,
          uniqueUsers: v.users.size,
        }))
        .sort((a, b) => b.actions - a.actions),
    };
  });
