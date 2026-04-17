import prisma from "@/lib/prisma";
import { DEFAULT_LEVELS, DEFAULT_RULES } from "./defaults";
import { DEFAULT_STAR_RULES } from "@/data/star-rules";
import { pusherServer } from "@/lib/pusher";

const EXPECTED_LEVEL_COUNT = DEFAULT_LEVELS.length;

export async function ensureLevelsSeed() {
  const count = await prisma.spacePointLevel.count();
  if (count !== EXPECTED_LEVEL_COUNT) {
    await prisma.userSpacePointSeal.deleteMany({});
    await prisma.spacePointLevel.deleteMany({});
    await prisma.spacePointLevel.createMany({ data: DEFAULT_LEVELS });
  }
}

export async function ensureGlobalSpacePointRules() {
  // for (const rule of DEFAULT_RULES) {
  //   const { category: _cat, ...data } = rule;
  //   await prisma.spacePointRule.upsert({
  //     where: { action: rule.action },
  //     create: data,
  //     update: {},
  //   });
  // }
}

export async function ensureOrgStarRules(orgId: string) {
  for (const rule of DEFAULT_STAR_RULES) {
    const { category: _cat, ...data } = rule;
    await prisma.starRule.upsert({
      where: { orgId_action: { orgId, action: rule.action } },
      create: { ...data, orgId },
      update: {},
    });
  }
}

export async function ensureUserPoint(userId: string, orgId: string) {
  return prisma.userSpacePoint.upsert({
    where: { userId },
    create: { userId, orgId },
    update: {},
  });
}

export async function getBadgeUrlMap(): Promise<Record<number, string>> {
  const rows = await prisma.platformAsset.findMany({
    where: { key: { startsWith: "badge:" } },
  });
  const map: Record<number, string> = {};
  for (const r of rows) {
    const num = parseInt(r.key.replace("badge:", ""));
    if (!isNaN(num)) map[num] = r.url;
  }
  return map;
}

export function resolveBadgeUrl(
  badgeNumber: number,
  map: Record<number, string>,
): string {
  return map[badgeNumber] ?? `/space-point/badges/${badgeNumber}.svg`;
}

export function periodToDateRange(
  period: "weekly" | "biweekly" | "monthly" | "annual" | "alltime" | "custom",
  startDate?: string,
  endDate?: string,
): { gte?: Date; lte?: Date } {
  const now = new Date();
  if (period === "custom")
    return {
      gte: startDate ? new Date(startDate) : undefined,
      lte: endDate ? new Date(endDate) : now,
    };
  if (period === "alltime") return {};
  const days = { weekly: 7, biweekly: 15, monthly: 30, annual: 365 }[period];
  const gte = new Date(now);
  gte.setDate(gte.getDate() - days);
  gte.setHours(0, 0, 0, 0);
  return { gte, lte: now };
}

export async function awardPoints(
  userId: string,
  orgId: string,
  action: string,
  descriptionOverride?: string,
  metadataOverride?: object,
): Promise<{
  points: number;
  newSeals: {
    name: string;
    badgeNumber: number;
    planetEmoji: string;
    badgeUrl: string;
  }[];
  totalPoints: number;
  popupTemplateId: string | null;
}> {
  await ensureLevelsSeed();
  await ensureGlobalSpacePointRules();
  await ensureOrgStarRules(orgId);

  const rule = await prisma.spacePointRule.findUnique({
    where: { action, isActive: true },
  });
  if (!rule || rule.points === 0)
    return { points: 0, newSeals: [], totalPoints: 0, popupTemplateId: null };

  if (rule.cooldownHours) {
    const cutoff = new Date(Date.now() - rule.cooldownHours * 3_600_000);
    const recent = await prisma.spacePointTransaction.findFirst({
      where: {
        rule: { action },
        userPoint: { userId },
        createdAt: { gte: cutoff },
      },
    });
    if (recent)
      return { points: 0, newSeals: [], totalPoints: 0, popupTemplateId: null };
  }

  const userPoint = await ensureUserPoint(userId, orgId);
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);

  const isSameWeek = userPoint.weekStart && userPoint.weekStart >= thisMonday;
  const newWeeklyPoints = Math.max(
    0,
    (isSameWeek ? userPoint.weeklyPoints : 0) + rule.points,
  );
  const newTotal = Math.max(0, userPoint.totalPoints + rule.points);

  const allLevels = await prisma.spacePointLevel.findMany({
    orderBy: { order: "asc" },
  });
  const earnedBefore = await prisma.userSpacePointSeal.findMany({
    where: { userPointId: userPoint.id },
    select: { levelId: true },
  });
  const earnedBeforeSet = new Set(earnedBefore.map((s) => s.levelId));

  await prisma.$transaction([
    prisma.spacePointTransaction.create({
      data: {
        userPointId: userPoint.id,
        orgId,
        ruleId: rule.id,
        points: rule.points,
        description: descriptionOverride ?? rule.label,
        metadata: metadataOverride ?? {},
      },
    }),
    prisma.userSpacePoint.update({
      where: { id: userPoint.id },
      data: {
        totalPoints: newTotal,
        weeklyPoints: newWeeklyPoints,
        weekStart: isSameWeek ? userPoint.weekStart : thisMonday,
      },
    }),
  ]);

  const badgeMap = await getBadgeUrlMap();
  const newSeals: {
    name: string;
    badgeNumber: number;
    planetEmoji: string;
    badgeUrl: string;
  }[] = [];
  for (const lvl of allLevels.filter(
    (l) => l.requiredPoints <= newTotal && !earnedBeforeSet.has(l.id),
  )) {
    await prisma.userSpacePointSeal.create({
      data: { userPointId: userPoint.id, levelId: lvl.id },
    });
    newSeals.push({
      name: lvl.name,
      badgeNumber: lvl.badgeNumber,
      planetEmoji: lvl.planetEmoji,
      badgeUrl: resolveBadgeUrl(lvl.badgeNumber, badgeMap),
    });
  }
  if (rule.points !== 0 || newSeals.length > 0) {
    try {
      const channelName = `private-user-${userId}`;
      await pusherServer.trigger(channelName, "points:updated", {
        spAwarded: rule.points,
        starsDebited: 0,
        totalSP: newTotal,
        popupTemplateId: rule.popupTemplateId ?? null,
        newSeals: newSeals,
        action: action,
      });
    } catch (err) {
      console.error("[space-point/utils] Pusher trigger error:", err);
    }
  }

  return {
    points: rule.points,
    newSeals,
    totalPoints: newTotal,
    popupTemplateId: rule.popupTemplateId ?? null,
  };
}
