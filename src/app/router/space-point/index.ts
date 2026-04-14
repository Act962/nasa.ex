export { DEFAULT_RULES, CATEGORY_LABEL } from "./defaults";

export {
  getMySpacePoint, earnSpacePoints, getSpacePointRanking, getUserStats,
  getSpacePointRules, updateSpacePointRule, createSpacePointRule, deleteSpacePointRule,
  getSpacePointPrizes, upsertSpacePointPrize, deleteSpacePointPrize,
} from "./user-routes";

export {
  adminGetSpaceOverview, adminGetOrgUsers, adminAdjustUserPoints,
  adminGetOrgRules, adminCreateOrgRule, adminUpdateOrgRule,
} from "./admin-routes";

import {
  getMySpacePoint, earnSpacePoints, getSpacePointRanking, getUserStats,
  getSpacePointRules, updateSpacePointRule, createSpacePointRule, deleteSpacePointRule,
  getSpacePointPrizes, upsertSpacePointPrize, deleteSpacePointPrize,
} from "./user-routes";

import {
  adminGetSpaceOverview, adminGetOrgUsers, adminAdjustUserPoints,
  adminGetOrgRules, adminCreateOrgRule, adminUpdateOrgRule,
} from "./admin-routes";

// ─── Default levels ────────────────────────────────────────────────────────────
const DEFAULT_LEVELS = [
  {
    order: 1,
    name: "Terra",
    requiredPoints: 0,
    badgeNumber: 1,
    planetEmoji: "🌍",
  },
  {
    order: 2,
    name: "Lua",
    requiredPoints: 100,
    badgeNumber: 2,
    planetEmoji: "🌙",
  },
  {
    order: 3,
    name: "Marte",
    requiredPoints: 200,
    badgeNumber: 3,
    planetEmoji: "🔴",
  },
  {
    order: 4,
    name: "Plutão",
    requiredPoints: 300,
    badgeNumber: 4,
    planetEmoji: "🪨",
  },
  {
    order: 5,
    name: "Vênus",
    requiredPoints: 400,
    badgeNumber: 5,
    planetEmoji: "🌟",
  },
  {
    order: 6,
    name: "Júpiter",
    requiredPoints: 500,
    badgeNumber: 6,
    planetEmoji: "🟠",
  },
  {
    order: 7,
    name: "Saturno",
    requiredPoints: 600,
    badgeNumber: 7,
    planetEmoji: "🪐",
  },
  {
    order: 8,
    name: "Urano",
    requiredPoints: 700,
    badgeNumber: 8,
    planetEmoji: "🔵",
  },
  {
    order: 9,
    name: "Netuno",
    requiredPoints: 800,
    badgeNumber: 9,
    planetEmoji: "💙",
  },
  {
    order: 10,
    name: "Mercúrio",
    requiredPoints: 900,
    badgeNumber: 10,
    planetEmoji: "⚪",
  },
  {
    order: 11,
    name: "Sol",
    requiredPoints: 1000,
    badgeNumber: 11,
    planetEmoji: "☀️",
  },
  {
    order: 12,
    name: "Galaxy 1",
    requiredPoints: 1001,
    badgeNumber: 12,
    planetEmoji: "🌌",
  },
  {
    order: 13,
    name: "Galaxy 2",
    requiredPoints: 2500,
    badgeNumber: 13,
    planetEmoji: "🌌",
  },
  {
    order: 14,
    name: "Galaxy 3",
    requiredPoints: 5000,
    badgeNumber: 14,
    planetEmoji: "🌌",
  },
  {
    order: 15,
    name: "Galaxy 4",
    requiredPoints: 7500,
    badgeNumber: 15,
    planetEmoji: "🌌",
  },
  {
    order: 16,
    name: "Galaxy 5",
    requiredPoints: 10000,
    badgeNumber: 16,
    planetEmoji: "🌌",
  },
  {
    order: 17,
    name: "Galaxy 6",
    requiredPoints: 20000,
    badgeNumber: 17,
    planetEmoji: "🌌",
  },
  {
    order: 18,
    name: "Galaxy 7",
    requiredPoints: 30000,
    badgeNumber: 18,
    planetEmoji: "🌌",
  },
  {
    order: 19,
    name: "Galaxy 8",
    requiredPoints: 40000,
    badgeNumber: 19,
    planetEmoji: "🌌",
  },
  {
    order: 20,
    name: "Galaxy 9",
    requiredPoints: 50000,
    badgeNumber: 20,
    planetEmoji: "🌌",
  },
  {
    order: 21,
    name: "Galaxy 10",
    requiredPoints: 100000,
    badgeNumber: 21,
    planetEmoji: "🌌",
  },
];

// ─── Default rules ─────────────────────────────────────────────────────────────
export const DEFAULT_RULES = [
  // Leads & Tracking
  {
    action: "lead_won",
    label: "Lead marcado como ganho",
    points: 10,
    cooldownHours: null,
    category: "leads",
  },
  {
    action: "first_lead",
    label: "Cadastrar primeiro lead",
    points: 20,
    cooldownHours: null,
    category: "leads",
  },
  {
    action: "create_lead",
    label: "Criar lead",
    points: 5,
    cooldownHours: null,
    category: "leads",
  },
  {
    action: "update_lead",
    label: "Atualizar lead",
    points: 3,
    cooldownHours: 1,
    category: "leads",
  },
  {
    action: "close_tracking",
    label: "Fechar tracking (todas as etapas)",
    points: 25,
    cooldownHours: null,
    category: "leads",
  },
  // Agenda & Eventos
  {
    action: "create_event",
    label: "Criar evento na agenda",
    points: 5,
    cooldownHours: 24,
    category: "agenda",
  },
  {
    action: "create_agenda",
    label: "Criar agenda",
    points: 8,
    cooldownHours: null,
    category: "agenda",
  },
  // Workspace
  {
    action: "create_workspace_card",
    label: "Criar card no workspace",
    points: 2,
    cooldownHours: 1,
    category: "workspace",
  },
  {
    action: "workspace_cards_10day",
    label: "10 cards no workspace em 1 dia",
    points: 15,
    cooldownHours: 24,
    category: "workspace",
  },
  // Formulários
  {
    action: "send_form",
    label: "Enviar formulário",
    points: 3,
    cooldownHours: 12,
    category: "form",
  },
  // Engajamento & Sistema
  {
    action: "daily_login",
    label: "Login diário no sistema",
    points: 5,
    cooldownHours: 24,
    category: "system",
  },
  {
    action: "active_30min",
    label: "30 minutos ativo no sistema",
    points: 10,
    cooldownHours: 4,
    category: "system",
  },
  {
    action: "active_2h",
    label: "2 horas ativo no sistema",
    points: 20,
    cooldownHours: 8,
    category: "system",
  },
  {
    action: "send_message",
    label: "Enviar mensagem no chat",
    points: 2,
    cooldownHours: 0.5,
    category: "system",
  },
  {
    action: "complete_profile",
    label: "Perfil completo (foto + informações)",
    points: 30,
    cooldownHours: null,
    category: "system",
  },
  // Ferramentas
  {
    action: "install_integration",
    label: "Instalar integração",
    points: 25,
    cooldownHours: null,
    category: "tools",
  },
  {
    action: "create_planner",
    label: "Criar plano de ação (Planner)",
    points: 10,
    cooldownHours: null,
    category: "tools",
  },
  {
    action: "upload_nbox",
    label: "Upload de arquivo no N.Box",
    points: 5,
    cooldownHours: 2,
    category: "tools",
  },
];

const CATEGORY_LABEL: Record<string, string> = {
  leads: "Leads & Tracking",
  agenda: "Agenda & Eventos",
  workspace: "Workspace",
  form: "Formulários",
  system: "Engajamento",
  tools: "Ferramentas",
  custom: "Personalizada",
};

// ─── Ensure levels ────────────────────────────────────────────────────────────
const EXPECTED_LEVEL_COUNT = DEFAULT_LEVELS.length;
async function ensureLevelsSeed() {
  const count = await prisma.spacePointLevel.count();
  if (count !== EXPECTED_LEVEL_COUNT) {
    await prisma.userSpacePointSeal.deleteMany({});
    await prisma.spacePointLevel.deleteMany({});
    await prisma.spacePointLevel.createMany({ data: DEFAULT_LEVELS });
  }
}

// ─── Ensure org rules (upsert — picks up new defaults without overwriting) ───
async function ensureOrgRules(orgId: string) {
  for (const rule of DEFAULT_RULES) {
    const { category: _cat, ...ruleData } = rule;
    await prisma.spacePointRule.upsert({
      where: { orgId_action: { orgId, action: rule.action } },
      create: { ...ruleData, orgId },
      update: {},
    });
  }
}

async function ensureUserPoint(userId: string, orgId: string) {
  return prisma.userSpacePoint.upsert({
    where: { userId_orgId: { userId, orgId } },
    create: { userId, orgId },
    update: {},
  });
}

// ─── Award points ─────────────────────────────────────────────────────────────
async function awardPoints(
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
}> {
  await ensureLevelsSeed();
  await ensureOrgRules(orgId);

  const rule = await prisma.spacePointRule.findFirst({
    where: { orgId, action, isActive: true },
  });
  if (!rule || rule.points <= 0)
    return { points: 0, newSeals: [], totalPoints: 0 };

  if (rule.cooldownHours) {
    const cutoff = new Date(Date.now() - rule.cooldownHours * 3_600_000);
    const recent = await prisma.spacePointTransaction.findFirst({
      where: {
        rule: { action },
        userPoint: { userId, orgId },
        createdAt: { gte: cutoff },
      },
    });
    if (recent) return { points: 0, newSeals: [], totalPoints: 0 };
  }

  const userPoint = await ensureUserPoint(userId, orgId);
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);

  const isSameWeek = userPoint.weekStart && userPoint.weekStart >= thisMonday;
  const newWeeklyPoints =
    (isSameWeek ? userPoint.weeklyPoints : 0) + rule.points;
  const newTotal = userPoint.totalPoints + rule.points;

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
  return { points: rule.points, newSeals, totalPoints: newTotal };
}

// ─── Period helper ────────────────────────────────────────────────────────────
function periodToDateRange(
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

// ─── Badge URL helper (reads custom S3 URLs from platform_asset) ──────────────
async function getBadgeUrlMap(): Promise<Record<number, string>> {
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
function resolveBadgeUrl(
  badgeNumber: number,
  map: Record<number, string>,
): string {
  return map[badgeNumber] ?? `/space-point/badges/${badgeNumber}.svg`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

export const getMySpacePoint = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get my space point data" })
  .output(
    z.object({
      totalPoints: z.number(),
      weeklyPoints: z.number(),
      currentLevel: z
        .object({
          order: z.number(),
          name: z.string(),
          requiredPoints: z.number(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          badgeUrl: z.string(),
        })
        .nullable(),
      nextLevel: z
        .object({
          order: z.number(),
          name: z.string(),
          requiredPoints: z.number(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          badgeUrl: z.string(),
        })
        .nullable(),
      progressPct: z.number(),
      seals: z.array(
        z.object({
          levelId: z.string(),
          name: z.string(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          earnedAt: z.string(),
          badgeUrl: z.string(),
        }),
      ),
      allLevels: z.array(
        z.object({
          id: z.string(),
          order: z.number(),
          name: z.string(),
          requiredPoints: z.number(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          badgeUrl: z.string(),
        }),
      ),
      recentTransactions: z.array(
        z.object({
          points: z.number(),
          description: z.string(),
          createdAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId)
      return {
        totalPoints: 0,
        weeklyPoints: 0,
        currentLevel: null,
        nextLevel: null,
        progressPct: 0,
        seals: [],
        allLevels: [],
        recentTransactions: [],
      };

    await ensureLevelsSeed();
    const [userPoint, allLevels, badgeMap] = await Promise.all([
      ensureUserPoint(user.id, orgId),
      prisma.spacePointLevel.findMany({ orderBy: { order: "asc" } }),
      getBadgeUrlMap(),
    ]);
    const earnedSeals = await prisma.userSpacePointSeal.findMany({
      where: { userPointId: userPoint.id },
      include: { level: true },
      orderBy: { earnedAt: "asc" },
    });
    const recentTx = await prisma.spacePointTransaction.findMany({
      where: { userPointId: userPoint.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const tp = userPoint.totalPoints;
    const earned = allLevels.filter((l) => l.requiredPoints <= tp);
    const currentLevel = earned.length > 0 ? earned[earned.length - 1] : null;
    const nextLevel = allLevels.find((l) => l.requiredPoints > tp) ?? null;
    const progressPct = !nextLevel
      ? 100
      : Math.min(
          100,
          Math.round(
            ((tp - (currentLevel?.requiredPoints ?? 0)) /
              (nextLevel.requiredPoints -
                (currentLevel?.requiredPoints ?? 0))) *
              100,
          ),
        );

    return {
      totalPoints: tp,
      weeklyPoints: userPoint.weeklyPoints,
      currentLevel: currentLevel
        ? {
            order: currentLevel.order,
            name: currentLevel.name,
            requiredPoints: currentLevel.requiredPoints,
            badgeNumber: currentLevel.badgeNumber,
            planetEmoji: currentLevel.planetEmoji,
            badgeUrl: resolveBadgeUrl(currentLevel.badgeNumber, badgeMap),
          }
        : null,
      nextLevel: nextLevel
        ? {
            order: nextLevel.order,
            name: nextLevel.name,
            requiredPoints: nextLevel.requiredPoints,
            badgeNumber: nextLevel.badgeNumber,
            planetEmoji: nextLevel.planetEmoji,
            badgeUrl: resolveBadgeUrl(nextLevel.badgeNumber, badgeMap),
          }
        : null,
      progressPct,
      seals: earnedSeals.map((s) => ({
        levelId: s.levelId,
        name: s.level.name,
        badgeNumber: s.level.badgeNumber,
        planetEmoji: s.level.planetEmoji,
        earnedAt: s.earnedAt.toISOString(),
        badgeUrl: resolveBadgeUrl(s.level.badgeNumber, badgeMap),
      })),
      allLevels: allLevels.map((l) => ({
        id: l.id,
        order: l.order,
        name: l.name,
        requiredPoints: l.requiredPoints,
        badgeNumber: l.badgeNumber,
        planetEmoji: l.planetEmoji,
        badgeUrl: resolveBadgeUrl(l.badgeNumber, badgeMap),
      })),
      recentTransactions: recentTx.map((t) => ({
        points: t.points,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  });

export const earnSpacePoints = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Earn space points" })
  .input(
    z.object({
      action: z.string(),
      description: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .output(
    z.object({
      awarded: z.number(),
      totalPoints: z.number(),
      newSeals: z.array(
        z.object({
          name: z.string(),
          badgeNumber: z.number(),
          planetEmoji: z.string(),
          badgeUrl: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { awarded: 0, totalPoints: 0, newSeals: [] };
    const result = await awardPoints(
      user.id,
      orgId,
      input.action,
      input.description,
      input.metadata as object,
    );
    return {
      awarded: result.points,
      totalPoints: result.totalPoints,
      newSeals: result.newSeals,
    };
  });

export const getSpacePointRanking = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get ranking" })
  .input(
    z.object({
      period: z
        .enum(["weekly", "biweekly", "monthly", "annual", "alltime", "custom"])
        .default("weekly"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        userId: z.string(),
        name: z.string(),
        image: z.string().nullable(),
        points: z.number(),
        rank: z.number(),
        levelName: z.string().nullable(),
        badgeNumber: z.number().nullable(),
        badgeUrl: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return [];

    await ensureLevelsSeed();
    const [allLevels, badgeMap] = await Promise.all([
      prisma.spacePointLevel.findMany({ orderBy: { order: "asc" } }),
      getBadgeUrlMap(),
    ]);

    if (input.period === "alltime") {
      const pts = await prisma.userSpacePoint.findMany({
        where: { orgId },
        include: { user: { select: { id: true, name: true, image: true } } },
        orderBy: { totalPoints: "desc" },
        take: 50,
      });
      return pts.map((p, i) => {
        const earned = allLevels.filter(
          (l) => l.requiredPoints <= p.totalPoints,
        );
        const lvl = earned[earned.length - 1] ?? null;
        return {
          userId: p.user.id,
          name: p.user.name,
          image: p.user.image,
          points: p.totalPoints,
          rank: i + 1,
          levelName: lvl?.name ?? null,
          badgeNumber: lvl?.badgeNumber ?? null,
          badgeUrl: lvl ? resolveBadgeUrl(lvl.badgeNumber, badgeMap) : null,
        };
      });
    }

    const { gte, lte } = periodToDateRange(
      input.period,
      input.startDate,
      input.endDate,
    );
    const allUserPts = await prisma.userSpacePoint.findMany({
      where: { orgId },
      include: { user: { select: { id: true, name: true, image: true } } },
    });
    const userPtMap = Object.fromEntries(allUserPts.map((u) => [u.id, u]));
    const txAgg = await prisma.spacePointTransaction.groupBy({
      by: ["userPointId"],
      where: { userPoint: { orgId }, createdAt: { gte, lte } },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 50,
    });

    return txAgg
      .map((row, i) => {
        const usp = userPtMap[row.userPointId];
        if (!usp) return null;
        const earned = allLevels.filter(
          (l) => l.requiredPoints <= usp.totalPoints,
        );
        const lvl = earned[earned.length - 1] ?? null;
        return {
          userId: usp.user.id,
          name: usp.user.name,
          image: usp.user.image,
          points: row._sum.points ?? 0,
          rank: i + 1,
          levelName: lvl?.name ?? null,
          badgeNumber: lvl?.badgeNumber ?? null,
          badgeUrl: lvl ? resolveBadgeUrl(lvl.badgeNumber, badgeMap) : null,
        };
      })
      .filter(Boolean) as {
      userId: string;
      name: string;
      image: string | null;
      points: number;
      rank: number;
      levelName: string | null;
      badgeNumber: number | null;
      badgeUrl: string | null;
    }[];
  });

export const getUserStats = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get user stats" })
  .input(
    z.object({
      targetUserId: z.string(),
      period: z
        .enum(["weekly", "biweekly", "monthly", "annual", "alltime", "custom"])
        .default("alltime"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
  )
  .output(
    z.object({
      totalInPeriod: z.number(),
      appBreakdown: z.array(
        z.object({
          action: z.string(),
          label: z.string(),
          points: z.number(),
          count: z.number(),
        }),
      ),
      history: z.array(
        z.object({
          points: z.number(),
          description: z.string(),
          action: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
      seals: z.array(
        z.object({
          name: z.string(),
          badgeNumber: z.number(),
          earnedAt: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId)
      return { totalInPeriod: 0, appBreakdown: [], history: [], seals: [] };

    const userPoint = await prisma.userSpacePoint.findUnique({
      where: { userId_orgId: { userId: input.targetUserId, orgId } },
    });
    if (!userPoint)
      return { totalInPeriod: 0, appBreakdown: [], history: [], seals: [] };

    const { gte, lte } = periodToDateRange(
      input.period,
      input.startDate,
      input.endDate,
    );
    const dateFilter = gte || lte ? { createdAt: { gte, lte } } : {};

    const transactions = await prisma.spacePointTransaction.findMany({
      where: { userPointId: userPoint.id, ...dateFilter },
      include: { rule: { select: { action: true, label: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const breakdown: Record<
      string,
      { action: string; label: string; points: number; count: number }
    > = {};
    let totalInPeriod = 0;
    for (const tx of transactions) {
      totalInPeriod += tx.points;
      const key = tx.rule?.action ?? "manual";
      const lbl = tx.rule?.label ?? tx.description;
      if (!breakdown[key])
        breakdown[key] = { action: key, label: lbl, points: 0, count: 0 };
      breakdown[key].points += tx.points;
      breakdown[key].count += 1;
    }

    const seals = await prisma.userSpacePointSeal.findMany({
      where: { userPointId: userPoint.id },
      include: { level: true },
      orderBy: { earnedAt: "desc" },
    });
    return {
      totalInPeriod,
      appBreakdown: Object.values(breakdown).sort(
        (a, b) => b.points - a.points,
      ),
      history: transactions.map((t) => ({
        points: t.points,
        description: t.description,
        action: t.rule?.action ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
      seals: seals.map((s) => ({
        name: s.level.name,
        badgeNumber: s.level.badgeNumber,
        earnedAt: s.earnedAt.toISOString(),
      })),
    };
  });

// ─── Rules ────────────────────────────────────────────────────────────────────

export const getSpacePointRules = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "List rules" })
  .output(
    z.array(
      z.object({
        id: z.string(),
        action: z.string(),
        label: z.string(),
        points: z.number(),
        cooldownHours: z.number().nullable(),
        isActive: z.boolean(),
        category: z.string(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return [];

    await ensureOrgRules(orgId);
    const rules = await prisma.spacePointRule.findMany({
      where: { orgId },
      orderBy: [{ isActive: "desc" }, { label: "asc" }],
    });
    const categoryMap = Object.fromEntries(
      DEFAULT_RULES.map((r) => [r.action, r.category]),
    );
    return rules.map((r) => ({
      id: r.id,
      action: r.action,
      label: r.label,
      points: r.points,
      cooldownHours: r.cooldownHours,
      isActive: r.isActive,
      category: categoryMap[r.action] ?? "custom",
    }));
  });

export const updateSpacePointRule = base
  .use(requiredAuthMiddleware)
  .route({ method: "PATCH", summary: "Update rule" })
  .input(
    z.object({
      id: z.string(),
      points: z.number().min(0).optional(),
      cooldownHours: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
      label: z.string().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const rule = await prisma.spacePointRule.findFirst({
      where: { id: input.id, orgId },
    });
    if (!rule) return { success: false };
    const { id, ...data } = input;
    await prisma.spacePointRule.update({ where: { id }, data });
    return { success: true };
  });

export const createSpacePointRule = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Create custom rule (master/moderador)" })
  .input(
    z.object({
      action: z.string().min(1),
      label: z.string().min(1),
      points: z.number().min(1),
      cooldownHours: z.number().nullable().optional(),
    }),
  )
  .output(z.object({ success: z.boolean(), id: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!member || !["owner", "admin", "moderador"].includes(member.role))
      return { success: false };
    const created = await prisma.spacePointRule.create({
      data: {
        orgId,
        action: input.action,
        label: input.label,
        points: input.points,
        cooldownHours: input.cooldownHours ?? null,
      },
    });
    return { success: true, id: created.id };
  });

export const deleteSpacePointRule = base
  .use(requiredAuthMiddleware)
  .route({ method: "DELETE", summary: "Delete custom rule" })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!member || !["owner", "admin", "moderador"].includes(member.role))
      return { success: false };
    const rule = await prisma.spacePointRule.findFirst({
      where: { id: input.id, orgId },
    });
    if (!rule) return { success: false };
    if (DEFAULT_RULES.some((r) => r.action === rule.action))
      return { success: false };
    await prisma.spacePointRule.delete({ where: { id: input.id } });
    return { success: true };
  });

// ─── Prizes ───────────────────────────────────────────────────────────────────

export const getSpacePointPrizes = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "Get ranking prizes" })
  .input(z.object({ period: z.string().default("monthly") }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        rank: z.number(),
        period: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        isActive: z.boolean(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const { session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return [];
    const prizes = await prisma.spacePointRankingPrize.findMany({
      where: { orgId, period: input.period },
      orderBy: { rank: "asc" },
    });
    return prizes.map((p) => ({
      id: p.id,
      rank: p.rank,
      period: p.period,
      title: p.title,
      description: p.description,
      isActive: p.isActive,
    }));
  });

export const upsertSpacePointPrize = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Upsert prize" })
  .input(
    z.object({
      rank: z.number().min(1).max(20),
      period: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ success: z.boolean(), id: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!member || !["owner", "admin", "moderador"].includes(member.role))
      return { success: false };
    const result = await prisma.spacePointRankingPrize.upsert({
      where: {
        orgId_rank_period: { orgId, rank: input.rank, period: input.period },
      },
      create: {
        orgId,
        rank: input.rank,
        period: input.period,
        title: input.title,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
      },
      update: {
        title: input.title,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
      },
    });
    return { success: true, id: result.id };
  });

export const deleteSpacePointPrize = base
  .use(requiredAuthMiddleware)
  .route({ method: "DELETE", summary: "Delete prize" })
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { user, session } = context;
    const orgId = session.activeOrganizationId;
    if (!orgId) return { success: false };
    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId: orgId },
    });
    if (!member || !["owner", "admin", "moderador"].includes(member.role))
      return { success: false };
    const prize = await prisma.spacePointRankingPrize.findFirst({
      where: { id: input.id, orgId },
    });
    if (!prize) return { success: false };
    await prisma.spacePointRankingPrize.delete({ where: { id: input.id } });
    return { success: true };
  });

// ─── Admin routes (system admin only) ────────────────────────────────────────

export const adminGetSpaceOverview = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin: global overview" })
  .output(
    z.object({
      totalUsers: z.number(),
      totalPointsAwarded: z.number(),
      activeOrgs: z.number(),
      topOrgs: z.array(
        z.object({
          orgId: z.string(),
          orgName: z.string(),
          totalPoints: z.number(),
          userCount: z.number(),
        }),
      ),
    }),
  )
  .handler(async () => {
    const [totalUsers, totalPointsAgg, orgGroups] = await Promise.all([
      prisma.userSpacePoint.count(),
      prisma.userSpacePoint.aggregate({ _sum: { totalPoints: true } }),
      prisma.userSpacePoint.groupBy({
        by: ["orgId"],
        _sum: { totalPoints: true },
        _count: { userId: true },
        orderBy: { _sum: { totalPoints: "desc" } },
        take: 10,
      }),
    ]);

    const orgIds = orgGroups.map((o) => o.orgId);
    const orgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
    });
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

    return {
      totalUsers,
      totalPointsAwarded: totalPointsAgg._sum.totalPoints ?? 0,
      activeOrgs: orgGroups.length,
      topOrgs: orgGroups.map((o) => ({
        orgId: o.orgId,
        orgName: orgMap[o.orgId] ?? "–",
        totalPoints: o._sum.totalPoints ?? 0,
        userCount: o._count.userId,
      })),
    };
  });

export const adminGetOrgUsers = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin: users for org" })
  .input(
    z.object({
      orgId: z.string(),
      page: z.number().default(1),
      limit: z.number().default(30),
    }),
  )
  .output(
    z.object({
      users: z.array(
        z.object({
          userId: z.string(),
          name: z.string(),
          email: z.string(),
          image: z.string().nullable(),
          totalPoints: z.number(),
          weeklyPoints: z.number(),
          levelName: z.string().nullable(),
        }),
      ),
      total: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    const allLevels = await prisma.spacePointLevel.findMany({
      orderBy: { order: "asc" },
    });
    const [pts, total] = await Promise.all([
      prisma.userSpacePoint.findMany({
        where: { orgId: input.orgId },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { totalPoints: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.userSpacePoint.count({ where: { orgId: input.orgId } }),
    ]);
    return {
      users: pts.map((p) => {
        const earned = allLevels.filter(
          (l) => l.requiredPoints <= p.totalPoints,
        );
        const lvl = earned[earned.length - 1] ?? null;
        return {
          userId: p.user.id,
          name: p.user.name,
          email: p.user.email,
          image: p.user.image,
          totalPoints: p.totalPoints,
          weeklyPoints: p.weeklyPoints,
          levelName: lvl?.name ?? null,
        };
      }),
      total,
    };
  });

export const adminAdjustUserPoints = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin: adjust user points" })
  .input(
    z.object({
      userId: z.string(),
      orgId: z.string(),
      points: z.number(),
      description: z.string().default("Ajuste manual pelo admin"),
    }),
  )
  .output(z.object({ success: z.boolean(), newTotal: z.number() }))
  .handler(async ({ input }) => {
    let userPoint = await prisma.userSpacePoint.findUnique({
      where: { userId_orgId: { userId: input.userId, orgId: input.orgId } },
    });
    if (!userPoint)
      userPoint = await prisma.userSpacePoint.create({
        data: { userId: input.userId, orgId: input.orgId },
      });
    const newTotal = Math.max(0, userPoint.totalPoints + input.points);
    await prisma.$transaction([
      prisma.userSpacePoint.update({
        where: { id: userPoint.id },
        data: { totalPoints: newTotal },
      }),
      prisma.spacePointTransaction.create({
        data: {
          userPointId: userPoint.id,
          points: input.points,
          description: input.description,
          metadata: { source: "admin_adjustment" },
        },
      }),
    ]);
    return { success: true, newTotal };
  });

export const adminGetOrgRules = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin: org rules" })
  .input(z.object({ orgId: z.string() }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        action: z.string(),
        label: z.string(),
        points: z.number(),
        cooldownHours: z.number().nullable(),
        isActive: z.boolean(),
      }),
    ),
  )
  .handler(async ({ input }) => {
    const rules = await prisma.spacePointRule.findMany({
      where: { orgId: input.orgId },
      orderBy: { label: "asc" },
    });
    return rules.map((r) => ({
      id: r.id,
      action: r.action,
      label: r.label,
      points: r.points,
      cooldownHours: r.cooldownHours,
      isActive: r.isActive,
    }));
  });

export const adminCreateOrgRule = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin: create rule for org" })
  .input(
    z.object({
      orgId: z.string(),
      action: z.string().min(1),
      label: z.string().min(1),
      points: z.number().min(1),
      cooldownHours: z.number().nullable().optional(),
    }),
  )
  .output(z.object({ success: z.boolean(), id: z.string().optional() }))
  .handler(async ({ input }) => {
    const { orgId, ...data } = input;
    const created = await prisma.spacePointRule.create({
      data: { orgId, ...data, cooldownHours: data.cooldownHours ?? null },
    });
    return { success: true, id: created.id };
  });

export const adminUpdateOrgRule = base
  .use(requireAdminMiddleware)
  .route({ method: "PATCH", summary: "Admin: update org rule" })
  .input(
    z.object({
      id: z.string(),
      points: z.number().min(0).optional(),
      cooldownHours: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
      label: z.string().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    const { id, ...data } = input;
    await prisma.spacePointRule.update({ where: { id }, data });
    return { success: true };
  });

// ─── Router export ────────────────────────────────────────────────────────────
export const spacePointRouter = {
  me: getMySpacePoint,
  earn: earnSpacePoints,
  ranking: getSpacePointRanking,
  userStats: getUserStats,
  rules: getSpacePointRules,
  updateRule: updateSpacePointRule,
  createRule: createSpacePointRule,
  deleteRule: deleteSpacePointRule,
  prizes: getSpacePointPrizes,
  upsertPrize: upsertSpacePointPrize,
  deletePrize: deleteSpacePointPrize,
  adminOverview: adminGetSpaceOverview,
  adminOrgUsers: adminGetOrgUsers,
  adminAdjust: adminAdjustUserPoints,
  adminOrgRules: adminGetOrgRules,
  adminCreateRule: adminCreateOrgRule,
  adminUpdateRule: adminUpdateOrgRule,
};
