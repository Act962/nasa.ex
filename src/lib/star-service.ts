/**
 * ★ Star Service — moeda interna da plataforma NASA
 *
 * Regras:
 *  - Cada plano creditia X stars no início de cada ciclo mensal
 *  - Rollover: no máximo 30 % das stars do plano passam para o ciclo seguinte
 *  - Top-ups nunca expiram
 *  - Cada integração ativa debita mensalmente (APP_CHARGE)
 *  - Ao instalar uma integração é cobrado um setupCost (APP_SETUP)
 */

import prisma from "@/lib/prisma";
import { StarTransactionType } from "@/generated/prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StarBalance {
  balance: number;
  planMonthlyStars: number;
  planSlug: string;
  planName: string;
  cycleStart: Date | null;
  nextCycleDate: Date | null;
}

export interface AppCostInfo {
  appSlug: string;
  monthlyCost: number;
  setupCost: number;
  priceBrl: number | null;
}

// ─── Balance ──────────────────────────────────────────────────────────────────

const WELCOME_BONUS = 100;

export async function checkBalance(
  organizationId: string,
): Promise<StarBalance> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      starsBalance: true,
      starsCycleStart: true,
      plan: {
        select: { slug: true, name: true, monthlyStars: true },
      },
    },
  });

  // ── Welcome bonus: crédito único de 100 stars no primeiro acesso ─────────
  const hasAnyTransaction = await prisma.starTransaction.count({
    where: { organizationId },
  });
  if (hasAnyTransaction === 0) {
    const newBalance = org.starsBalance + WELCOME_BONUS;
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: { starsBalance: newBalance },
      }),
      prisma.starTransaction.create({
        data: {
          organizationId,
          type: StarTransactionType.MANUAL_ADJUST,
          amount: WELCOME_BONUS,
          balanceAfter: newBalance,
          description: "🎉 Bônus de boas-vindas ao NASA",
        },
      }),
    ]);
    org.starsBalance = newBalance;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const plan = org.plan ?? { slug: "free", name: "Free", monthlyStars: 100 };

  let nextCycleDate: Date | null = null;
  if (org.starsCycleStart) {
    const d = new Date(org.starsCycleStart);
    d.setMonth(d.getMonth() + 1);
    nextCycleDate = d;
  }

  return {
    balance: org.starsBalance,
    planMonthlyStars: plan.monthlyStars,
    planSlug: plan.slug,
    planName: plan.name,
    cycleStart: org.starsCycleStart,
    nextCycleDate,
  };
}

// ─── Moderator Check ─────────────────────────────────────────────────────────

const MODERATOR_REFILL_THRESHOLD = 100; // Reabastece quando saldo ≤ este valor
const MODERATOR_REFILL_AMOUNT = 1_000_000; // Valor de reabastecimento

/**
 * Verifica se a organização possui pelo menos um membro com role "moderador".
 * Moderadores recebem reabastecimento automático quando o saldo chega a ≤ 100 ★.
 */
async function orgHasModerator(organizationId: string): Promise<boolean> {
  const count = await prisma.member.count({
    where: {
      organizationId,
      role: "moderador",
    },
  });
  return count > 0;
}

// ─── Debit ────────────────────────────────────────────────────────────────────

export async function debitStars(
  organizationId: string,
  amount: number,
  type: StarTransactionType,
  description: string,
  appSlug?: string,
  userId?: string, // opcional: identifica qual usuário gerou o débito
): Promise<{ success: boolean; newBalance: number }> {
  // ── Debitar dentro de uma transação atômica ───────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { starsBalance: true },
    });

    if (org.starsBalance < amount) {
      return { success: false, newBalance: org.starsBalance };
    }

    const newBalance = org.starsBalance - amount;

    await tx.organization.update({
      where: { id: organizationId },
      data: { starsBalance: newBalance },
    });

    // userId é persistido no próprio registro da transação.
    // O uso mensal por usuário é calculado on-the-fly via getMonthlyUsageByUser()
    // sem nenhum contador acumulado que precise de reset.
    await tx.starTransaction.create({
      data: {
        organizationId,
        userId: userId ?? null,
        type,
        amount: -amount,
        balanceAfter: newBalance,
        description,
        appSlug,
      },
    });

    return { success: true, newBalance };
  });

  // ── 2. Reabastecimento para moderadores ──────────────────────────────────
  // Se o saldo chegou a ≤ 100 e a org tem um membro moderador → recarrega para 1.000.000
  if (result.success && result.newBalance <= MODERATOR_REFILL_THRESHOLD) {
    try {
      const isMod = await orgHasModerator(organizationId);
      if (isMod) {
        await prisma.$transaction(async (tx) => {
          // Lê o saldo mais recente dentro da transação
          const org = await tx.organization.findUniqueOrThrow({
            where: { id: organizationId },
            select: { starsBalance: true },
          });

          // Só reabastece se ainda estiver no limiar (evita double-refill em paralelo)
          if (org.starsBalance > MODERATOR_REFILL_THRESHOLD) return;

          const topupAmount = MODERATOR_REFILL_AMOUNT - org.starsBalance;
          const refillBalance = MODERATOR_REFILL_AMOUNT;

          await tx.organization.update({
            where: { id: organizationId },
            data: { starsBalance: refillBalance },
          });

          await tx.starTransaction.create({
            data: {
              organizationId,
              type: StarTransactionType.MANUAL_ADJUST,
              amount: topupAmount,
              balanceAfter: refillBalance,
              description: `Reabastecimento automático moderador: saldo atingiu ≤${MODERATOR_REFILL_THRESHOLD} ★ → +${topupAmount.toLocaleString("pt-BR")} ★ (total ${MODERATOR_REFILL_AMOUNT.toLocaleString("pt-BR")} ★)`,
            },
          });
        });

        // Retorna com o saldo já reabastecido
        return { success: true, newBalance: MODERATOR_REFILL_AMOUNT };
      }
    } catch {
      // Reabastecimento é não-crítico: falha silenciosa
    }
  }

  return result;
}

// ─── Credit (internal) ────────────────────────────────────────────────────────

async function creditStars(
  organizationId: string,
  amount: number,
  type: StarTransactionType,
  description: string,
  packageId?: string,
): Promise<number> {
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { starsBalance: true },
    });

    const newBalance = org.starsBalance + amount;

    await tx.organization.update({
      where: { id: organizationId },
      data: { starsBalance: newBalance },
    });

    await tx.starTransaction.create({
      data: {
        organizationId,
        type,
        amount,
        balanceAfter: newBalance,
        description,
        packageId,
      },
    });

    return newBalance;
  });

  return result;
}

// ─── Top-up purchase ──────────────────────────────────────────────────────────

export async function purchaseTopUp(
  organizationId: string,
  packageId: string,
): Promise<{ success: boolean; newBalance: number; starsAdded: number }> {
  const pkg = await prisma.starPackage.findUniqueOrThrow({
    where: { id: packageId },
    select: { stars: true, label: true, isActive: true },
  });

  if (!pkg.isActive) {
    throw new Error("Pacote não disponível.");
  }

  const newBalance = await creditStars(
    organizationId,
    pkg.stars,
    StarTransactionType.TOPUP_PURCHASE,
    `Compra de pacote ${pkg.label}`,
    packageId,
  );

  return { success: true, newBalance, starsAdded: pkg.stars };
}

// ─── Monthly cycle ────────────────────────────────────────────────────────────

/**
 * Runs the monthly cycle for an organization:
 *  1. Apply rollover from previous balance (up to `rolloverPct` of plan stars)
 *  2. Credit plan stars
 *  3. Debit monthly app charges for all active workspace integrations
 */
export async function runMonthlyCycle(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      starsBalance: true,
      starsCycleStart: true,
      plan: true,
      workspaceIntegrations: {
        where: { isActive: true },
        select: { appSlug: true },
      },
    },
  });

  if (!org.plan) return;

  const { monthlyStars, rolloverPct } = org.plan;
  const maxRollover = Math.floor(monthlyStars * (rolloverPct / 100));
  const rollover = Math.min(org.starsBalance, maxRollover);

  // Reset balance to rollover amount, then credit plan stars
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      starsBalance: rollover,
      starsCycleStart: new Date(),
    },
  });

  if (rollover > 0) {
    await prisma.starTransaction.create({
      data: {
        organizationId,
        type: StarTransactionType.ROLLOVER,
        amount: rollover,
        balanceAfter: rollover,
        description: `Rollover do ciclo anterior (${rollover} ★)`,
      },
    });
  }

  // Credit plan stars
  await creditStars(
    organizationId,
    monthlyStars,
    StarTransactionType.PLAN_CREDIT,
    `Crédito mensal do plano ${org.plan.name} (${monthlyStars} ★)`,
  );

  // Debit monthly charges for each active app
  for (const wi of org.workspaceIntegrations) {
    const appCost = await prisma.appStarCost.findUnique({
      where: { appSlug: wi.appSlug },
    });
    if (!appCost || appCost.monthlyCost === 0) continue;

    await debitStars(
      organizationId,
      appCost.monthlyCost,
      StarTransactionType.APP_CHARGE,
      `Cobrança mensal — ${wi.appSlug} (${appCost.monthlyCost} ★)`,
      wi.appSlug,
    );

    await prisma.workspaceIntegration.update({
      where: {
        organizationId_appSlug: { organizationId, appSlug: wi.appSlug },
      },
      data: { lastChargedAt: new Date() },
    });
  }
}

// ─── Monthly usage per user (on-the-fly, sem contador acumulado) ─────────────

/**
 * Retorna o total de stars debitadas por um usuário no mês corrente.
 *
 * "Mês corrente" = do dia 1 do mês atual (UTC) até agora.
 * Nunca precisa de reset: filtra diretamente em StarTransaction por createdAt.
 *
 * @param organizationId  ID da organização
 * @param userId          ID do usuário
 * @param cycleStart      Se fornecido, usa essa data como início do ciclo em vez do mês calendário
 */
export async function getMonthlyUsageByUser(
  organizationId: string,
  userId: string,
  cycleStart?: Date | null,
): Promise<number> {
  const start = cycleStart
    ? new Date(cycleStart)
    : (() => {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      })();

  const agg = await prisma.starTransaction.aggregate({
    where: {
      organizationId,
      userId,
      amount: { lt: 0 }, // apenas débitos
      createdAt: { gte: start },
    },
    _sum: { amount: true },
  });

  // amount é negativo para débitos → retorna valor positivo
  return Math.abs(agg._sum.amount ?? 0);
}

/**
 * Retorna o uso mensal de todos os membros de uma organização de uma vez.
 * Usa uma única query GROUP BY para evitar N+1.
 */
export async function getMonthlyUsageAllMembers(
  organizationId: string,
  cycleStart?: Date | null,
): Promise<Map<string, number>> {
  const start = cycleStart
    ? new Date(cycleStart)
    : (() => {
        const d = new Date();
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      })();

  const rows = await prisma.starTransaction.groupBy({
    by: ["userId"],
    where: {
      organizationId,
      userId: { not: null },
      amount: { lt: 0 },
      createdAt: { gte: start },
    },
    _sum: { amount: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.userId) {
      map.set(row.userId, Math.abs(row._sum.amount ?? 0));
    }
  }
  return map;
}

// ─── App cost info ────────────────────────────────────────────────────────────

export async function getAppCost(appSlug: string): Promise<AppCostInfo | null> {
  const cost = await prisma.appStarCost.findUnique({
    where: { appSlug },
    select: {
      appSlug: true,
      monthlyCost: true,
      setupCost: true,
      priceBrl: true,
    },
  });
  if (!cost) return null;
  return {
    appSlug: cost.appSlug,
    monthlyCost: cost.monthlyCost,
    setupCost: cost.setupCost,
    priceBrl: cost.priceBrl ? Number(cost.priceBrl) : null,
  };
}

// ─── Install app (charge setup fee) ──────────────────────────────────────────

export async function installApp(
  organizationId: string,
  appSlug: string,
): Promise<{
  success: boolean;
  newBalance: number;
  insufficientStars: boolean;
}> {
  const appCost = await prisma.appStarCost.findUnique({ where: { appSlug } });
  const setupCost = appCost?.setupCost ?? 0;

  // Upsert workspace integration
  await prisma.workspaceIntegration.upsert({
    where: { organizationId_appSlug: { organizationId, appSlug } },
    update: { isActive: true },
    create: { organizationId, appSlug },
  });

  if (setupCost === 0) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { starsBalance: true },
    });
    return {
      success: true,
      newBalance: org.starsBalance,
      insufficientStars: false,
    };
  }

  const result = await debitStars(
    organizationId,
    setupCost,
    StarTransactionType.APP_SETUP,
    `Ativação da integração — ${appSlug} (${setupCost} ★)`,
    appSlug,
  );

  return {
    success: result.success,
    newBalance: result.newBalance,
    insufficientStars: !result.success,
  };
}
