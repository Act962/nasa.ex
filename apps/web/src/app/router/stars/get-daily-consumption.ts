import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

const CYCLE_DAYS = 30;
const DEBIT_TYPES = ["APP_CHARGE", "APP_SETUP", "COURSE_PURCHASE"] as const;

/**
 * Retorna o consumo diário de STARs da org no ciclo atual — usado pelo
 * tile do Insights (`stars-consumption-tile.tsx`) pra renderizar o
 * gráfico de linha de consumo dia-a-dia.
 *
 * Returns: array com `{ date: 'YYYY-MM-DD', total: number }` ordenado
 * cronologicamente, **com dias zerados preenchidos** (não pula dias sem
 * débito) — facilita renderizar no gráfico sem gaps.
 */
export const getStarsDailyConsumption = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { createdAt: true, starsCycleStart: true },
    });
    const cycleStart = org.starsCycleStart ?? org.createdAt;
    const now = new Date();
    const cycleEnd = new Date(cycleStart.getTime() + CYCLE_DAYS * 24 * 60 * 60 * 1000);

    const debits = await prisma.starTransaction.findMany({
      where: {
        organizationId: orgId,
        type: { in: [...DEBIT_TYPES] },
        createdAt: { gte: cycleStart, lte: cycleEnd },
      },
      select: { amount: true, createdAt: true },
    });

    // Agrega por dia (YYYY-MM-DD) em UTC.
    const byDayMap = new Map<string, number>();
    for (const t of debits) {
      const day = new Date(t.createdAt).toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + Math.abs(t.amount));
    }

    // Gera todos os dias do ciclo (até hoje), preenchendo zeros.
    const series: { date: string; total: number }[] = [];
    const endIter = now < cycleEnd ? now : cycleEnd;
    const cursor = new Date(cycleStart);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= endIter) {
      const key = cursor.toISOString().slice(0, 10);
      series.push({ date: key, total: byDayMap.get(key) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const totalConsumed = series.reduce((s, d) => s + d.total, 0);
    const daysElapsed = Math.max(1, series.length);
    const avgPerDay = totalConsumed / daysElapsed;
    // Projeção linear pro fim do ciclo.
    const projection = Math.round(avgPerDay * CYCLE_DAYS);

    return {
      cycleStart,
      cycleEnd,
      series,
      totalConsumed,
      avgPerDay,
      projection,
    };
  });
