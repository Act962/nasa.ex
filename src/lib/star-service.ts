/**
 * ★ Star Service — moeda interna da plataforma NASA
 *
 * Regras:
 *  - Modelo de Cota (0 → Limite): starsBalance representa o USO no ciclo atual.
 *  - Reset Mensal: O uso zera automaticamente todo mês (Lazy Reset).
 *  - Limite Padrão: 100 stars para usuários sem plano.
 *  - Extras (Top-ups): Guardados em starsExtraBalance, não expiram e são usados após a cota do plano.
 */

import prisma from "@/lib/prisma";
import { StarTransactionType } from "@/generated/prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StarBalance {
  used: number;              // Uso no ciclo atual (antigo starsBalance)
  planMonthlyStars: number;  // Limite do plano (ex: 1000)
  extraBalance: number;      // Saldo fixo de compras extras (top-ups)
  totalLimit: number;        // planMonthlyStars + extraBalance (para exibição)
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

export async function checkBalance(organizationId: string): Promise<StarBalance> {
  let org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      starsBalance: true,
      starsExtraBalance: true,
      starsCycleStart: true,
      plan: {
        select: { slug: true, name: true, monthlyStars: true },
      },
    },
  });

  const now = new Date();

  // ── 1. Lazy Monthly Reset Logic ──────────────────────────────────────────
  let nextCycleDate: Date | null = null;
  
  if (!org.starsCycleStart) {
    // Primeiro acesso: define o ciclo como agora
    await prisma.organization.update({
      where: { id: organizationId },
      data: { starsCycleStart: now },
    });
    org.starsCycleStart = now;
  }

  const cycleStart = new Date(org.starsCycleStart);
  const resetDate = new Date(cycleStart);
  resetDate.setMonth(resetDate.getMonth() + 1);

  if (now >= resetDate) {
    // O mês virou! Reseta o uso (starsBalance)
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: { 
          starsBalance: 0,
          starsCycleStart: now, // Novo ciclo começa hoje
        },
      }),
      prisma.starTransaction.create({
        data: {
          organizationId,
          type: StarTransactionType.PLAN_CREDIT,
          amount: 0,
          balanceAfter: 0,
          description: "🔄 Ciclo renovado: uso mensal resetado para 0",
        },
      }),
    ]);
    org.starsBalance = 0;
    org.starsCycleStart = now;
    
    const newNext = new Date(now);
    newNext.setMonth(newNext.getMonth() + 1);
    nextCycleDate = newNext;
  } else {
    nextCycleDate = resetDate;
  }

  // ── 2. Defaults & Quota Calculation ──────────────────────────────────────
  const plan = org.plan ?? { slug: "free", name: "Gratuito", monthlyStars: 100 };
  const planStars = plan.monthlyStars || 100;

  return {
    used: org.starsBalance,
    planMonthlyStars: planStars,
    extraBalance: org.starsExtraBalance,
    totalLimit: planStars + org.starsExtraBalance,
    planSlug: plan.slug,
    planName: plan.name,
    cycleStart: org.starsCycleStart,
    nextCycleDate,
  };
}

// ─── Debit (Usage Tracking) ───────────────────────────────────────────────────

export async function debitStars(
  organizationId: string,
  amount: number,
  type: StarTransactionType,
  description: string,
  appSlug?: string,
  userId?: string,
): Promise<{ success: boolean; newUsed: number }> {
  
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { 
        starsBalance: true, 
        starsExtraBalance: true,
        plan: { select: { monthlyStars: true } }
      },
    });

    const planLimit = org.plan?.monthlyStars ?? 100;
    const totalAvailable = (planLimit - org.starsBalance) + org.starsExtraBalance;

    if (totalAvailable < amount) {
      return { success: false, newUsed: org.starsBalance };
    }

    let remainingToDebit = amount;
    let newStarsBalance = org.starsBalance;
    let newExtraBalance = org.starsExtraBalance;

    // 1. Consome primeiro a cota do plano (até atingir planLimit)
    if (newStarsBalance < planLimit) {
      const spaceInPlan = planLimit - newStarsBalance;
      const toTakeFromPlan = Math.min(spaceInPlan, remainingToDebit);
      
      newStarsBalance += toTakeFromPlan;
      remainingToDebit -= toTakeFromPlan;
    }

    // 2. Se ainda sobrou débito, retira do starsExtraBalance (compras extras)
    if (remainingToDebit > 0) {
      newExtraBalance -= remainingToDebit;
    }

    // Atualiza a organização
    await tx.organization.update({
      where: { id: organizationId },
      data: { 
        starsBalance: newStarsBalance,
        starsExtraBalance: newExtraBalance,
      },
    });

    // Registra a transação
    await tx.starTransaction.create({
      data: {
        organizationId,
        type,
        amount: -amount,
        balanceAfter: newStarsBalance, // Para o extrato, mostramos o uso do mês
        description,
        appSlug,
      },
    });

    // Rastreio individual de usuário
    if (userId) {
      await tx.memberStarBudget.upsert({
        where: { organizationId_userId: { organizationId, userId } },
        update: { currentUsage: { increment: amount } },
        create: {
          id: `${organizationId}-${userId}`,
          organizationId,
          userId,
          monthlyBudget: 0,
          currentUsage: amount,
        },
      });
    }

    return { success: true, newUsed: newStarsBalance };
  });

  return result;
}

// ─── Top-up purchase ──────────────────────────────────────────────────────────

export async function purchaseTopUp(
  organizationId: string,
  packageId: string
): Promise<{ success: boolean; starsAdded: number }> {
  const pkg = await prisma.starPackage.findUniqueOrThrow({
    where: { id: packageId },
    select: { stars: true, label: true, isActive: true },
  });

  if (!pkg.isActive) {
    throw new Error("Pacote não disponível.");
  }

  await prisma.$transaction(async (tx) => {
    // Adiciona ao starsExtraBalance (que não reseta mensalmente)
    await tx.organization.update({
      where: { id: organizationId },
      data: { starsExtraBalance: { increment: pkg.stars } },
    });

    await tx.starTransaction.create({
      data: {
        organizationId,
        type: StarTransactionType.TOPUP_PURCHASE,
        amount: pkg.stars,
        balanceAfter: 0, // No novo modelo, transações de crédito não alteram o "Uso"
        description: `Compra de pacote extra: ${pkg.label} (+${pkg.stars} ★)`,
        packageId,
      },
    });
  });

  return { success: true, starsAdded: pkg.stars };
}

// ─── App cost info ────────────────────────────────────────────────────────────

export async function getAppCost(appSlug: string): Promise<AppCostInfo | null> {
  const cost = await prisma.appStarCost.findUnique({
    where: { appSlug },
    select: { appSlug: true, monthlyCost: true, setupCost: true, priceBrl: true },
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
  appSlug: string
): Promise<{ success: boolean; insufficientStars: boolean }> {
  const appCost = await prisma.appStarCost.findUnique({ where: { appSlug } });
  const setupCost = appCost?.setupCost ?? 0;

  // Upsert workspace integration
  await prisma.workspaceIntegration.upsert({
    where: { organizationId_appSlug: { organizationId, appSlug } },
    update: { isActive: true },
    create: { organizationId, appSlug },
  });

  if (setupCost === 0) {
    return { success: true, insufficientStars: false };
  }

  const result = await debitStars(
    organizationId,
    setupCost,
    StarTransactionType.APP_SETUP,
    `Ativação da integração — ${appSlug} (${setupCost} ★)`,
    appSlug
  );

  return {
    success: result.success,
    insufficientStars: !result.success,
  };
}
