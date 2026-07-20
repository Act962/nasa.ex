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
  balance: number; // saldo gastável (planos, top-ups, payouts) — pode pagar curso no Router
  bonusBalance: number; // saldo de bônus (welcome, promoções) — NÃO pode pagar curso no Router
  protectedBalance: number; // parcela de `balance` originada de compras — não expira na virada
  totalBalance: number; // soma dos dois — pra exibição/rastreio apenas
  planMonthlyStars: number;
  planSlug: string;
  planName: string;
  cycleStart: Date | null;
  nextCycleDate: Date | null;
  graceStartedAt: Date | null;
  suspendedAt: Date | null;
}

export interface DebitOpts {
  /**
   * `true` (default): se o saldo gastável não cobrir o valor, complementa com bônus.
   * `false`: valida apenas contra `starsBalance`. Usado em compra de curso (Router),
   * onde bônus de boas-vindas não pode ser aceito como pagamento.
   */
  allowBonus?: boolean;
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
      starsBonusBalance: true,
      starsProtectedBalance: true,
      starsCycleStart: true,
      starsCycleEnd: true,
      starsGraceStartedAt: true,
      starsSuspendedAt: true,
      plan: {
        select: { slug: true, name: true, monthlyStars: true },
      },
    },
  });

  // ── Welcome bonus: crédito único de 100 stars no primeiro acesso ─────────
  // Crédita em starsBonusBalance — não pode ser usado pra comprar curso no Router.
  const hasAnyTransaction = await prisma.starTransaction.count({
    where: { organizationId },
  });
  if (hasAnyTransaction === 0) {
    const newBonusBalance = org.starsBonusBalance + WELCOME_BONUS;
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: organizationId },
        data: { starsBonusBalance: newBonusBalance },
      }),
      prisma.starTransaction.create({
        data: {
          organizationId,
          type: StarTransactionType.WELCOME_BONUS,
          amount: WELCOME_BONUS,
          balanceAfter: org.starsBalance,
          description: "🎉 Bônus de boas-vindas ao NASA",
        },
      }),
    ]);
    org.starsBonusBalance = newBonusBalance;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const plan = org.plan ?? { slug: "free", name: "Gratuito", monthlyStars: 0 };

  // `starsCycleEnd` é escrito pelo ciclo e ancorado no período real do Stripe.
  // O fallback +1 mês cobre orgs anteriores à renovação automática, que ainda
  // não passaram por um ciclo.
  let nextCycleDate: Date | null = org.starsCycleEnd;
  if (!nextCycleDate && org.starsCycleStart) {
    const fallback = new Date(org.starsCycleStart);
    fallback.setMonth(fallback.getMonth() + 1);
    nextCycleDate = fallback;
  }

  return {
    balance: org.starsBalance,
    bonusBalance: org.starsBonusBalance,
    protectedBalance: org.starsProtectedBalance,
    totalBalance: org.starsBalance + org.starsBonusBalance,
    planMonthlyStars: plan.monthlyStars,
    planSlug: plan.slug,
    planName: plan.name,
    cycleStart: org.starsCycleStart,
    nextCycleDate,
    graceStartedAt: org.starsGraceStartedAt,
    suspendedAt: org.starsSuspendedAt,
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
  userId?: string, // opcional: rastreia consumo individual do usuário
  opts?: DebitOpts, // opcional: { allowBonus?: boolean = true }
): Promise<{ success: boolean; newBalance: number; newBonusBalance: number }> {
  const allowBonus = opts?.allowBonus ?? true;

  // ── 1. Debitar dentro de uma transação atômica ────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        starsBalance: true,
        starsBonusBalance: true,
        starsProtectedBalance: true,
      },
    });

    const totalAvailable = allowBonus
      ? org.starsBalance + org.starsBonusBalance
      : org.starsBalance;

    if (totalAvailable < amount) {
      return {
        success: false,
        newBalance: org.starsBalance,
        newBonusBalance: org.starsBonusBalance,
      };
    }

    // Debita gastáveis primeiro; se faltar, complementa do bônus (quando permitido).
    const fromMain = Math.min(org.starsBalance, amount);
    const fromBonus = amount - fromMain;
    const newBalance = org.starsBalance - fromMain;
    const newBonusBalance = org.starsBonusBalance - fromBonus;

    // A parcela protegida (compras) nunca excede o saldo. O clamp faz a cota do
    // plano — perecível — ser consumida antes das Stars pagas.
    const newProtectedBalance = Math.min(
      org.starsProtectedBalance,
      newBalance,
    );

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        starsBalance: newBalance,
        ...(fromBonus > 0 && { starsBonusBalance: newBonusBalance }),
        ...(newProtectedBalance !== org.starsProtectedBalance && {
          starsProtectedBalance: newProtectedBalance,
        }),
      },
    });

    const finalDescription =
      fromBonus > 0
        ? `${description} (${fromMain}★ saldo + ${fromBonus}★ bônus)`
        : description;

    await tx.starTransaction.create({
      data: {
        organizationId,
        type,
        amount: -amount,
        balanceAfter: newBalance,
        description: finalDescription,
        appSlug,
      },
    });

    // ── Incrementar currentUsage por usuário (se informado) ─────────────────
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

    return { success: true, newBalance, newBonusBalance };
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
        return {
          success: true,
          newBalance: MODERATOR_REFILL_AMOUNT,
          newBonusBalance: result.newBonusBalance,
        };
      }
    } catch {
      // Reabastecimento é não-crítico: falha silenciosa
    }
  }

  // ── 3. Hook pós-débito: dispara alertas + inicia grace period ────────────
  // Não-crítico: falha silenciosa pra não bloquear a operação principal.
  if (result.success) {
    try {
      await dispatchPostDebitAlerts(organizationId, result.newBalance);
    } catch (err) {
      console.warn("[star-service] post-debit alert dispatch failed", err);
    }
  }

  return result;
}

/**
 * Pós-débito: verifica % consumido vs limite do plano e dispara
 * notificações em níveis (70% warn, 90% critical). Inicia grace period
 * se saldo zerou pela primeira vez.
 *
 * Anti-spam: `Organization.starsLastAlertAt` garante no máximo 1
 * dispatch/24h por severidade — evita flood na bell quando o user
 * consome muito num curto período.
 */
async function dispatchPostDebitAlerts(
  organizationId: string,
  newBalance: number,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      planId: true,
      starsCycleStart: true,
      starsGraceStartedAt: true,
      starsSuspendedAt: true,
      starsLastAlertAt: true,
    },
  });
  if (!org) return;

  // 1) Saldo zerou agora e ainda não está em grace → inicia grace + notif.
  if (newBalance === 0 && !org.starsGraceStartedAt && !org.starsSuspendedAt) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { starsGraceStartedAt: new Date() },
    });
    await emitStarsAlert(organizationId, "grace_start", {
      orgName: org.name,
      daysLeft: 15,
    });
    return; // Não disparamos outros alertas — grace é o evento mais grave
  }

  // 2) Alertas de threshold — só fazem sentido com plano ativo + ciclo iniciado
  if (!org.planId || !org.starsCycleStart) return;

  const plan = await prisma.plan.findUnique({
    where: { id: org.planId },
    select: { monthlyStars: true },
  });
  if (!plan?.monthlyStars || plan.monthlyStars <= 0) return;

  // Consumo do ciclo: soma absoluta dos débitos APP_CHARGE/SETUP.
  const consumedAgg = await prisma.starTransaction.aggregate({
    where: {
      organizationId,
      createdAt: { gte: org.starsCycleStart },
      type: { in: ["APP_CHARGE", "APP_SETUP"] },
    },
    _sum: { amount: true },
  });
  const consumed = Math.abs(consumedAgg._sum.amount ?? 0);
  const pctUsed = (consumed / plan.monthlyStars) * 100;

  const severity: "critical" | "warning" | null =
    pctUsed >= 90 ? "critical" : pctUsed >= 70 ? "warning" : null;
  if (!severity) return;

  // Anti-spam: 1 dispatch / 24h.
  const lastAlertAt = org.starsLastAlertAt;
  if (lastAlertAt) {
    const hoursSince = (Date.now() - lastAlertAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) return;
  }

  await emitStarsAlert(organizationId, severity, {
    orgName: org.name,
    pctUsed: Math.round(pctUsed),
  });
  await prisma.organization.update({
    where: { id: organizationId },
    data: { starsLastAlertAt: new Date() },
  });
}

/**
 * Dispara notificação `STARS_ALERT` pra todos os moderadores/owners da
 * org. Usa o pattern existente do `notification-service` — broadcast
 * Pusher no canal `private-org-${id}` + bell icon.
 */
async function emitStarsAlert(
  organizationId: string,
  severity: "warning" | "critical" | "grace_start",
  ctx: { orgName: string; pctUsed?: number; daysLeft?: number },
): Promise<void> {
  // Import dinâmico pra evitar ciclo de import (notification-service usa
  // o stars-service em outro caminho potencial).
  const { createOrgNotification } = await import(
    "@/features/admin/lib/notification-service"
  );

  const cfg = {
    warning: {
      title: "Saldo de STARs baixo",
      body: `Você já usou ${ctx.pctUsed}% do plano deste ciclo. Considere recarregar.`,
      severity: "warning" as const,
    },
    critical: {
      title: "Saldo crítico de STARs",
      body: `${ctx.pctUsed}% do plano consumido. Integrações pagas serão pausadas se zerar.`,
      severity: "critical" as const,
    },
    grace_start: {
      title: "Saldo de STARs zerou",
      body: `Você tem ${ctx.daysLeft} dias pra recarregar. Após isso a conta será suspensa.`,
      severity: "critical" as const,
    },
  }[severity];

  await createOrgNotification({
    organizationId,
    type: "STARS_ALERT",
    severity: cfg.severity,
    title: cfg.title,
    body: cfg.body,
  });
}

// ─── Credit (internal) ────────────────────────────────────────────────────────

async function creditStars(
  organizationId: string,
  amount: number,
  type: StarTransactionType,
  description: string,
  packageId?: string,
  /**
   * `true` para Stars pagas (top-up, payouts): entram também no saldo protegido
   * e portanto sobrevivem à virada de ciclo.
   */
  isProtected = false,
): Promise<number> {
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { starsBalance: true },
    });

    const newBalance = org.starsBalance + amount;

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        starsBalance: newBalance,
        ...(isProtected && { starsProtectedBalance: { increment: amount } }),
      },
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
    true, // Stars pagas — não expiram na virada de ciclo
  );

  return { success: true, newBalance, starsAdded: pkg.stars };
}

// ─── Monthly cycle ────────────────────────────────────────────────────────────

/**
 * Wrapper retrocompatível — a lógica real vive em `star-cycle-service`, que é
 * idempotente e ancorada no período de cobrança do Stripe. Mantido para os
 * call-sites existentes (`afterCreateOrganization`, propagação de plano).
 *
 * O import é dinâmico porque `star-cycle-service` importa `debitStars` daqui.
 */
export async function runMonthlyCycle(organizationId: string): Promise<void> {
  const { ensureStarsCycle } = await import("./star-cycle-service");
  await ensureStarsCycle(organizationId, "first_activation");
}

// ─── Plan billing eligibility ────────────────────────────────────────────────

/**
 * Determina se a organização deve ser cobrada pela assinatura do plano.
 * Retorna `false` quando a org tem `partnerLifetimeGranted=true`
 * (parceiro NASA Partner tier Infinity recebe acesso vitalício).
 *
 * O cobrador mensal de assinatura (Stripe / Asaas) deve consultar este
 * helper antes de gerar fatura. Se retornar `false`, pular cobrança e
 * registrar log de cortesia.
 */
export async function shouldChargePlanForOrganization(
  organizationId: string,
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { partnerLifetimeGranted: true },
  });
  if (!org) return true;
  return !org.partnerLifetimeGranted;
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
