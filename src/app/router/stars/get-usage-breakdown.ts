import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

const CYCLE_DAYS = 30;
const DEBIT_TYPES = ["APP_CHARGE", "APP_SETUP", "COURSE_PURCHASE"] as const;

/**
 * Retorna o consumo de Stars da org no ciclo atual, agregado por app
 * e por usuário, junto com metadados do plano. Alimenta:
 *   - O cálculo correto de "Stars consumidas" no header (fix do bug
 *     onde balance era usado como consumed)
 *   - A seção "Uso do plano por app" no popover
 *   - O painel admin de consumo por usuário (futuro)
 *
 * Ciclo: 30 dias a contar de `organization.starsCycleStart` (ou
 * `createdAt` se nulo).
 */
export const getStarsUsageBreakdown = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        id: true,
        createdAt: true,
        starsBalance: true,
        starsBonusBalance: true,
        starsCycleStart: true,
      },
    });

    const cycleStart = org.starsCycleStart ?? org.createdAt;
    const cycleEnd = new Date(cycleStart.getTime() + CYCLE_DAYS * 24 * 60 * 60 * 1000);

    // ── Plano ativo via Better Auth subscription (se disponível) ─────
    // Fallback: lê via `Subscription` em DB ou assume free.
    const subscription = await prisma.subscription.findFirst({
      where: {
        referenceId: orgId,
        status: "active",
      },
      select: { plan: true, periodEnd: true },
      orderBy: { createdAt: "desc" },
    });

    const planSlug = subscription?.plan?.toLowerCase() ?? "free";
    const isPayPerUse = planSlug === "suite";

    // monthlyStars do plano — busca em Plan se existe modelo, senão 0
    const plan = await prisma.plan.findFirst({
      where: { slug: planSlug },
      select: { monthlyStars: true, name: true },
    });
    const planMonthlyStars = plan?.monthlyStars ?? 0;

    // ── Débitos no ciclo ─────────────────────────────────────────────
    const debits = await prisma.starTransaction.findMany({
      where: {
        organizationId: orgId,
        type: { in: [...DEBIT_TYPES] },
        createdAt: { gte: cycleStart },
      },
      select: { amount: true, appSlug: true },
    });

    const consumedInCycle = debits.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // ── Agregado por app ────────────────────────────────────────────
    const byAppMap = new Map<string, number>();
    for (const t of debits) {
      const key = t.appSlug ?? "other";
      byAppMap.set(key, (byAppMap.get(key) ?? 0) + Math.abs(t.amount));
    }
    const byApp = Array.from(byAppMap.entries())
      .map(([appSlug, total]) => ({ appSlug, label: APP_LABELS[appSlug] ?? appSlug, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // ── Agregado por usuário (via MemberStarBudget.currentUsage) ────
    const memberUsage = await prisma.memberStarBudget.findMany({
      where: { organizationId: orgId, currentUsage: { gt: 0 } },
      orderBy: { currentUsage: "desc" },
      take: 10,
      select: {
        userId: true,
        currentUsage: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });
    const byUser = memberUsage.map((m) => ({
      userId: m.userId,
      name: m.user?.name ?? "Usuário",
      image: m.user?.image ?? null,
      total: m.currentUsage,
    }));

    return {
      consumedInCycle,
      cycleStart,
      cycleEnd,
      byApp,
      byUser,
      planMonthlyStars,
      planSlug,
      planName: plan?.name ?? planSlug.toUpperCase(),
      isPayPerUse,
      bonusBalance: org.starsBonusBalance,
      balance: org.starsBalance,
    };
  });

// Labels de display pros appSlugs conhecidos.
const APP_LABELS: Record<string, string> = {
  forge: "Forge",
  spacetime: "SpaceTime",
  chat: "Chat",
  tracking: "Tracking",
  "nasa-planner": "NASA Planner",
  workspace: "Workspace",
  forms: "Formulários",
  nbox: "N-Box",
  payment: "Pagamentos",
  linnker: "Linnker",
  "space-points": "Space Points",
  stars: "Stars",
  "space-station": "Space Station",
  "nasa-route": "NASA Route",
  "nasa-command": "NASA Command",
  astro: "Astro IA",
  insights: "Insights",
  workflow: "Workflows",
  calendar: "Calendário",
  pages: "Pages",
  other: "Outros",
};
