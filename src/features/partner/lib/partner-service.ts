/**
 * NASA Partner Service — helpers para o programa de parceiros
 *
 * Responsabilidades:
 *  - Geração lazy de PartnerReferralLink (1 por usuário)
 *  - Cálculo de tier baseado em referrals ATIVOS (não apenas cadastrados)
 *  - Snapshot de comissão e desconto na compra de STARs
 *  - Avaliação de qualificação contínua (ativa/em risco/inativa)
 *  - Carência de downgrade
 *
 * Princípio: tudo financeiro é PERSISTIDO COMO SNAPSHOT no momento do evento.
 * Nunca recalcular depois com base no preço atual.
 */

import { customAlphabet } from "nanoid";
import prisma from "@/lib/prisma";
import { PartnerStatus, PartnerTier } from "@/generated/prisma/client";
import type {
  Partner,
  PartnerProgramSettings,
  Prisma,
} from "@/generated/prisma/client";

// ─── Constantes / helpers ────────────────────────────────────────────────────

const REFERRAL_CODE_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; // sem 0/O/1/l/I
const generateReferralCode = customAlphabet(REFERRAL_CODE_ALPHABET, 8);

const SETTINGS_ID = "singleton";

export const TIER_ORDER: PartnerTier[] = [
  "SUITE",
  "EARTH",
  "GALAXY",
  "CONSTELLATION",
  "INFINITY",
];

export function tierRank(tier: PartnerTier | null | undefined): number {
  if (!tier) return -1;
  return TIER_ORDER.indexOf(tier);
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getProgramSettings(): Promise<PartnerProgramSettings> {
  const existing = await prisma.partnerProgramSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) return existing;
  return prisma.partnerProgramSettings.create({ data: { id: SETTINGS_ID } });
}

export function getCommissionRateForTier(
  tier: PartnerTier,
  s: PartnerProgramSettings,
): number {
  switch (tier) {
    case "SUITE":
      return s.suiteCommissionRate.toNumber();
    case "EARTH":
      return s.earthCommissionRate.toNumber();
    case "GALAXY":
      return s.galaxyCommissionRate.toNumber();
    case "CONSTELLATION":
      return s.constellationCommissionRate.toNumber();
    case "INFINITY":
      return s.infinityCommissionRate.toNumber();
  }
}

export function getDiscountRateForTier(
  tier: PartnerTier,
  s: PartnerProgramSettings,
): number {
  switch (tier) {
    case "SUITE":
      return s.suiteDiscountRate.toNumber();
    case "EARTH":
      return s.earthDiscountRate.toNumber();
    case "GALAXY":
      return s.galaxyDiscountRate.toNumber();
    case "CONSTELLATION":
      return s.constellationDiscountRate.toNumber();
    case "INFINITY":
      return s.infinityDiscountRate.toNumber();
  }
}

export function getThresholdForTier(
  tier: PartnerTier,
  s: PartnerProgramSettings,
): number {
  switch (tier) {
    case "SUITE":
      return s.suiteThreshold;
    case "EARTH":
      return s.earthThreshold;
    case "GALAXY":
      return s.galaxyThreshold;
    case "CONSTELLATION":
      return s.constellationThreshold;
    case "INFINITY":
      return s.infinityThreshold;
  }
}

/**
 * Decide o tier-alvo a partir do número de referrals ATIVOS.
 * Retorna null se ainda não atingiu o tier mínimo (Suite).
 */
export function decideTierByActiveReferrals(
  activeCount: number,
  s: PartnerProgramSettings,
): PartnerTier | null {
  if (activeCount >= s.infinityThreshold) return "INFINITY";
  if (activeCount >= s.constellationThreshold) return "CONSTELLATION";
  if (activeCount >= s.galaxyThreshold) return "GALAXY";
  if (activeCount >= s.earthThreshold) return "EARTH";
  if (activeCount >= s.suiteThreshold) return "SUITE";
  return null;
}

export function tierLabel(tier: PartnerTier): string {
  return {
    SUITE: "Parceiro Suite",
    EARTH: "Parceiro Earth",
    GALAXY: "Parceiro Galaxy",
    CONSTELLATION: "Parceiro Constellation",
    INFINITY: "Parceiro Infinity",
  }[tier];
}

// ─── Referral Link ───────────────────────────────────────────────────────────

export async function getOrCreateReferralLink(userId: string) {
  const existing = await prisma.partnerReferralLink.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  // Garante código único (loop seguro até 5 tentativas)
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode();
    try {
      return await prisma.partnerReferralLink.create({
        data: { userId, code },
      });
    } catch (err) {
      const e = err as { code?: string };
      if (e.code !== "P2002") throw err;
    }
  }
  throw new Error("Não foi possível gerar código de indicação único");
}

export async function findActiveLinkByCode(code: string) {
  return prisma.partnerReferralLink.findUnique({ where: { code } });
}

// ─── Referrals ───────────────────────────────────────────────────────────────

/**
 * Vincula uma org recém-criada ao parceiro indicador, via link.
 * Idempotente: se já existe vínculo para essa org, retorna o existente.
 */
export async function attachReferralFromLink(params: {
  linkCode: string;
  newOrganizationId: string;
}) {
  const { linkCode, newOrganizationId } = params;

  const link = await prisma.partnerReferralLink.findUnique({
    where: { code: linkCode },
    include: { user: { select: { id: true } } },
  });
  if (!link) return null;

  const existing = await prisma.partnerReferral.findUnique({
    where: { referredOrganizationId: newOrganizationId },
  });
  if (existing) return existing;

  // Bloquear auto-indicação: se o dono da nova org for o mesmo do link, ignora
  const newOrgMembers = await prisma.member.findMany({
    where: { organizationId: newOrganizationId },
    select: { userId: true },
  });
  if (newOrgMembers.some((m) => m.userId === link.userId)) {
    return null;
  }

  const referral = await prisma.$transaction(async (tx) => {
    const created = await tx.partnerReferral.create({
      data: {
        linkId: link.id,
        partnerUserId: link.userId,
        referredOrganizationId: newOrganizationId,
        source: "link",
      },
    });
    await tx.partnerReferralLink.update({
      where: { id: link.id },
      data: { signups: { increment: 1 } },
    });
    return created;
  });

  return referral;
}

// ─── Cálculo de comissão (snapshot) ──────────────────────────────────────────

export interface CommissionSnapshotInput {
  starsPaymentId: string;
  organizationId: string;
  amountBrl: number; // total efetivamente pago pela org (já com qualquer ajuste)
  package: {
    id: string;
    label: string;
    stars: number;
    priceBrl: number; // preço cheio do pacote no momento (snapshot)
  };
}

/**
 * Cria PartnerCommission a partir de um StarsPayment confirmado.
 * Retorna a comissão criada ou null se não houver parceiro vinculado/ativo.
 */
export async function createCommissionFromPayment(
  input: CommissionSnapshotInput,
) {
  const { starsPaymentId, organizationId, amountBrl, package: pkg } = input;

  const referral = await prisma.partnerReferral.findUnique({
    where: { referredOrganizationId: organizationId },
    include: {
      partnerUser: {
        include: { partner: true },
      },
    },
  });
  if (!referral) return null;

  const partner = referral.partnerUser.partner;
  if (!partner || partner.status !== PartnerStatus.ACTIVE || !partner.tier) {
    return null;
  }

  // Idempotência: já existe comissão para este pagamento?
  const existing = await prisma.partnerCommission.findUnique({
    where: { starsPaymentId },
  });
  if (existing) return existing;

  const settings = await getProgramSettings();
  const ratePercent = getCommissionRateForTier(partner.tier, settings);
  const commissionBrl = round2(amountBrl * (ratePercent / 100));
  const cycle = currentCycleYearMonth();
  const unitPrice =
    pkg.stars > 0 ? round4(pkg.priceBrl / pkg.stars) : 0;

  const commission = await prisma.$transaction(async (tx) => {
    const c = await tx.partnerCommission.create({
      data: {
        partnerId: partner.id,
        starsPaymentId,
        organizationId,
        tierAtMoment: partner.tier!,
        ratePercent,
        packageIdSnapshot: pkg.id,
        packageLabelSnapshot: pkg.label,
        starsAmountSnapshot: pkg.stars,
        unitPriceBrlSnapshot: unitPrice,
        basePaymentBrl: amountBrl,
        commissionBrl,
        cycleYearMonth: cycle,
      },
    });
    await tx.partner.update({
      where: { id: partner.id },
      data: {
        totalEarnedBrl: { increment: commissionBrl },
        totalReferralRevenueBrl: { increment: amountBrl },
      },
    });
    return c;
  });

  return commission;
}

// ─── Compra do parceiro com desconto ─────────────────────────────────────────

export interface PartnerPurchaseInput {
  starsPaymentId: string;
  partnerId: string;
  tier: PartnerTier;
  discountRatePercent: number;
  starsAmount: number;
  originalPriceBrl: number;
  paidPriceBrl: number;
}

export async function recordPartnerPurchase(input: PartnerPurchaseInput) {
  const existing = await prisma.partnerStarPurchase.findUnique({
    where: { starsPaymentId: input.starsPaymentId },
  });
  if (existing) return existing;

  const savings = round2(input.originalPriceBrl - input.paidPriceBrl);

  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.partnerStarPurchase.create({
      data: {
        partnerId: input.partnerId,
        starsPaymentId: input.starsPaymentId,
        tierAtMoment: input.tier,
        discountRatePercent: input.discountRatePercent,
        starsAmountSnapshot: input.starsAmount,
        originalPriceBrl: input.originalPriceBrl,
        paidPriceBrl: input.paidPriceBrl,
        savingsBrl: savings,
      },
    });
    await tx.partner.update({
      where: { id: input.partnerId },
      data: { totalSavingsBrl: { increment: savings } },
    });
    return p;
  });

  return purchase;
}

// ─── Pós-pagamento: processa todos os efeitos do parceiro ───────────────────

/**
 * Após confirmar um StarsPayment como "paid", processa todos os efeitos
 * relacionados ao programa de parceiros:
 *
 *  1. Se a org compradora tem PartnerReferral ACTIVE → cria PartnerCommission
 *     (snapshot completo).
 *  2. Se o usuário comprador é um Partner ACTIVE com desconto aplicado
 *     (metadata.partnerDiscount) → cria PartnerStarPurchase de auditoria.
 *  3. Dispara recálculo de atividade do referral (idempotente).
 *
 * Idempotente — pode ser chamado várias vezes (proteções via @unique nos
 * registros derivados).
 */
export async function processPaymentPartnerEffects(starsPaymentId: string) {
  const payment = await prisma.starsPayment.findUnique({
    where: { id: starsPaymentId },
  });
  if (!payment || payment.status !== "paid") return;

  // StarsPayment não tem relation com StarPackage no schema — busca explícita.
  const pkg = await prisma.starPackage.findUnique({
    where: { id: payment.packageId },
  });
  if (!pkg) return;

  const result = {
    commission: null as null | { id: string },
    purchase: null as null | { id: string },
  };

  // 1. Comissão para o parceiro indicador (se houver)
  const commission = await createCommissionFromPayment({
    starsPaymentId: payment.id,
    organizationId: payment.organizationId,
    amountBrl: payment.amountBrl.toNumber(),
    package: {
      id: pkg.id,
      label: pkg.label,
      stars: pkg.stars,
      priceBrl: pkg.priceBrl.toNumber(),
    },
  });
  if (commission) result.commission = { id: commission.id };

  // 2. Auditoria de compra do parceiro (se foi com desconto)
  const meta = (payment.metadata ?? null) as Record<string, unknown> | null;
  const partnerDiscount = meta && typeof meta === "object"
    ? (meta as { partnerDiscount?: unknown }).partnerDiscount
    : null;

  if (partnerDiscount && typeof partnerDiscount === "object") {
    const pd = partnerDiscount as {
      partnerId?: string;
      tier?: PartnerTier;
      ratePercent?: number;
      originalBrl?: number;
      paidBrl?: number;
    };
    if (pd.partnerId && pd.tier && pd.originalBrl != null && pd.paidBrl != null) {
      const purchase = await recordPartnerPurchase({
        starsPaymentId: payment.id,
        partnerId: pd.partnerId,
        tier: pd.tier,
        discountRatePercent: pd.ratePercent ?? 0,
        starsAmount: payment.starsAmount,
        originalPriceBrl: pd.originalBrl,
        paidPriceBrl: pd.paidBrl,
      });
      result.purchase = { id: purchase.id };
    }
  }

  // 3. Recalcular atividade da org indicada (asynchronous-friendly)
  const referral = await prisma.partnerReferral.findUnique({
    where: { referredOrganizationId: payment.organizationId },
    select: { id: true, partnerUser: { select: { partner: { select: { id: true } } } } },
  });
  if (referral) {
    try {
      await recalcReferralActivity(referral.id);
      const partnerId = referral.partnerUser.partner?.id;
      if (partnerId) await recalcPartnerTier(partnerId);
    } catch (err) {
      console.warn("[partner] recalc after payment failed:", err);
    }
  }

  return result;
}

// ─── Atividade dos referrals ─────────────────────────────────────────────────

export type ActivityComputation = {
  status: "ACTIVE" | "AT_RISK" | "INACTIVE";
  lastQualifyingActivityAt: Date | null;
  lastQualifyingType: "purchase" | "consumption" | null;
  totalStarsConsumed: number;
  totalPurchasedBrl: number;
};

/**
 * Avalia se uma org indicada está ativa, em risco ou inativa
 * com base nas regras vigentes.
 */
export async function evaluateReferralActivity(
  referralId: string,
): Promise<ActivityComputation> {
  const referral = await prisma.partnerReferral.findUniqueOrThrow({
    where: { id: referralId },
  });
  const settings = await getProgramSettings();

  const windowStart = new Date(
    Date.now() - settings.activeOrgWindowDays * 24 * 60 * 60 * 1000,
  );

  // Compras pagas dentro da janela
  const paymentsAgg = await prisma.starsPayment.aggregate({
    where: {
      organizationId: referral.referredOrganizationId,
      status: "paid",
      createdAt: { gte: windowStart },
    },
    _sum: { amountBrl: true },
    _max: { createdAt: true },
  });

  // Consumo (débitos) dentro da janela
  const consumptionAgg = await prisma.starTransaction.aggregate({
    where: {
      organizationId: referral.referredOrganizationId,
      type: { in: ["APP_CHARGE", "APP_SETUP", "COURSE_PURCHASE"] },
      createdAt: { gte: windowStart },
    },
    _sum: { amount: true },
    _max: { createdAt: true },
  });

  const purchasedInWindow = paymentsAgg._sum.amountBrl?.toNumber() ?? 0;
  const consumedInWindow = Math.abs(consumptionAgg._sum.amount ?? 0);

  // Acumulados totais (não apenas janela)
  const totalPaymentsAgg = await prisma.starsPayment.aggregate({
    where: {
      organizationId: referral.referredOrganizationId,
      status: "paid",
    },
    _sum: { amountBrl: true },
  });
  const totalConsumptionAgg = await prisma.starTransaction.aggregate({
    where: {
      organizationId: referral.referredOrganizationId,
      type: { in: ["APP_CHARGE", "APP_SETUP", "COURSE_PURCHASE"] },
    },
    _sum: { amount: true },
  });

  const lastPayment = paymentsAgg._max.createdAt;
  const lastConsumption = consumptionAgg._max.createdAt;
  let lastQualifyingActivityAt: Date | null = null;
  let lastQualifyingType: "purchase" | "consumption" | null = null;
  if (lastPayment && (!lastConsumption || lastPayment > lastConsumption)) {
    lastQualifyingActivityAt = lastPayment;
    lastQualifyingType = "purchase";
  } else if (lastConsumption) {
    lastQualifyingActivityAt = lastConsumption;
    lastQualifyingType = "consumption";
  }

  const meetsActive =
    purchasedInWindow >= settings.activeOrgMinPurchaseBrl.toNumber() &&
    consumedInWindow >= settings.activeOrgMinStarsConsumed
      ? true
      : purchasedInWindow > 0 || consumedInWindow > 0
        ? consumedInWindow >= settings.activeOrgMinStarsConsumed ||
          purchasedInWindow >= settings.activeOrgMinPurchaseBrl.toNumber()
        : false;

  let status: ActivityComputation["status"];
  if (meetsActive) {
    if (lastQualifyingActivityAt) {
      const expiresAt = new Date(
        lastQualifyingActivityAt.getTime() +
          settings.activeOrgWindowDays * 24 * 60 * 60 * 1000,
      );
      const daysUntilExpire = Math.floor(
        (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      status =
        daysUntilExpire <= settings.atRiskWarningDays ? "AT_RISK" : "ACTIVE";
    } else {
      status = "ACTIVE";
    }
  } else {
    status = "INACTIVE";
  }

  return {
    status,
    lastQualifyingActivityAt,
    lastQualifyingType,
    totalStarsConsumed: Math.abs(totalConsumptionAgg._sum.amount ?? 0),
    totalPurchasedBrl: totalPaymentsAgg._sum.amountBrl?.toNumber() ?? 0,
  };
}

export async function recalcReferralActivity(referralId: string) {
  const result = await evaluateReferralActivity(referralId);
  await prisma.partnerReferral.update({
    where: { id: referralId },
    data: {
      activityStatus: result.status,
      lastQualifyingActivityAt: result.lastQualifyingActivityAt,
      lastQualifyingType: result.lastQualifyingType,
      totalStarsConsumed: result.totalStarsConsumed,
      totalPurchasedBrl: result.totalPurchasedBrl,
      activityRecalcedAt: new Date(),
    },
  });
  return result;
}

// ─── Cálculo de tier ─────────────────────────────────────────────────────────

export interface TierRecalcResult {
  partnerId: string;
  fromTier: PartnerTier | null;
  toTier: PartnerTier | null;
  activeReferrals: number;
  reason: string;
  graceStarted?: boolean;
  graceExpired?: boolean;
}

/**
 * Recalcula o tier de um Partner a partir de:
 *  - Contagem de PartnerReferral com activityStatus=ACTIVE
 *  - Settings vigentes
 *  - Política de carência de downgrade
 *  - Manual override pelo admin
 */
export async function recalcPartnerTier(
  partnerId: string,
  options: { triggeredById?: string } = {},
): Promise<TierRecalcResult> {
  const partner = await prisma.partner.findUniqueOrThrow({
    where: { id: partnerId },
  });
  const settings = await getProgramSettings();

  const activeCount = await prisma.partnerReferral.count({
    where: {
      partnerUserId: partner.userId,
      activityStatus: "ACTIVE",
    },
  });

  const targetTier = decideTierByActiveReferrals(activeCount, settings);
  const fromTier = partner.tier;

  // Manual override: nunca rebaixa abaixo do tier manual
  let effectiveTarget = targetTier;
  if (
    partner.manualTierOverride &&
    partner.tier &&
    tierRank(targetTier ?? null) < tierRank(partner.tier)
  ) {
    effectiveTarget = partner.tier;
  }

  const targetRank = tierRank(effectiveTarget ?? null);
  const currentRank = tierRank(fromTier ?? null);

  // ────────── UPGRADE ──────────
  if (targetRank > currentRank) {
    const updateData: Prisma.PartnerUpdateInput = {
      tier: effectiveTarget!,
      tierAchievedAt: new Date(),
      gracePeriodEndsAt: null,
      gracePeriodFromTier: null,
      gracePeriodToTier: null,
      lastTierEvalAt: new Date(),
    };
    if (!partner.activatedAt) {
      updateData.activatedAt = new Date();
      updateData.status = PartnerStatus.ACTIVE;
    }
    await prisma.$transaction(async (tx) => {
      await tx.partner.update({ where: { id: partnerId }, data: updateData });
      await tx.partnerTierHistory.create({
        data: {
          partnerId,
          fromTier,
          toTier: effectiveTarget!,
          reason: partner.activatedAt ? "auto_upgrade" : "first_activation",
          activeReferrals: activeCount,
          triggeredById: options.triggeredById ?? null,
        },
      });
      // INFINITY → conceder vitalício
      if (effectiveTarget === "INFINITY") {
        const myOrgs = await tx.member.findMany({
          where: { userId: partner.userId, role: "owner" },
          select: { organizationId: true },
        });
        for (const m of myOrgs) {
          await tx.organization.update({
            where: { id: m.organizationId },
            data: { partnerLifetimeGranted: true },
          });
        }
      }
    });
    return {
      partnerId,
      fromTier,
      toTier: effectiveTarget,
      activeReferrals: activeCount,
      reason: partner.activatedAt ? "auto_upgrade" : "first_activation",
    };
  }

  // ────────── MANTÉM ──────────
  if (targetRank === currentRank) {
    // Carência ativa? Verificar se pode cancelar
    if (partner.gracePeriodEndsAt) {
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          gracePeriodEndsAt: null,
          gracePeriodFromTier: null,
          gracePeriodToTier: null,
          lastTierEvalAt: new Date(),
        },
      });
    } else {
      await prisma.partner.update({
        where: { id: partnerId },
        data: { lastTierEvalAt: new Date() },
      });
    }
    return {
      partnerId,
      fromTier,
      toTier: fromTier,
      activeReferrals: activeCount,
      reason: "no_change",
    };
  }

  // ────────── DOWNGRADE ──────────
  // Se está em carência e expirou: aplica
  if (partner.gracePeriodEndsAt && partner.gracePeriodEndsAt <= new Date()) {
    await prisma.$transaction(async (tx) => {
      await tx.partner.update({
        where: { id: partnerId },
        data: {
          tier: effectiveTarget,
          tierAchievedAt: new Date(),
          gracePeriodEndsAt: null,
          gracePeriodFromTier: null,
          gracePeriodToTier: null,
          lastTierEvalAt: new Date(),
        },
      });
      await tx.partnerTierHistory.create({
        data: {
          partnerId,
          fromTier,
          toTier: effectiveTarget,
          reason: "grace_expired",
          activeReferrals: activeCount,
          triggeredById: options.triggeredById ?? null,
        },
      });
      // Se saiu de INFINITY, remove vitalício das orgs
      if (fromTier === "INFINITY" && effectiveTarget !== "INFINITY") {
        const myOrgs = await tx.member.findMany({
          where: { userId: partner.userId, role: "owner" },
          select: { organizationId: true },
        });
        for (const m of myOrgs) {
          await tx.organization.update({
            where: { id: m.organizationId },
            data: { partnerLifetimeGranted: false },
          });
        }
      }
    });
    return {
      partnerId,
      fromTier,
      toTier: effectiveTarget,
      activeReferrals: activeCount,
      reason: "grace_expired",
      graceExpired: true,
    };
  }

  // Inicia carência (se não está em uma)
  if (!partner.gracePeriodEndsAt) {
    const endsAt = new Date(
      Date.now() + settings.downgradeGracePeriodDays * 24 * 60 * 60 * 1000,
    );
    await prisma.partner.update({
      where: { id: partnerId },
      data: {
        gracePeriodEndsAt: endsAt,
        gracePeriodFromTier: fromTier,
        gracePeriodToTier: effectiveTarget,
        lastTierEvalAt: new Date(),
      },
    });
    return {
      partnerId,
      fromTier,
      toTier: fromTier,
      activeReferrals: activeCount,
      reason: "grace_started",
      graceStarted: true,
    };
  }

  // Já em carência, mas piorou ainda mais: apenas atualiza target
  await prisma.partner.update({
    where: { id: partnerId },
    data: {
      gracePeriodToTier: effectiveTarget,
      lastTierEvalAt: new Date(),
    },
  });
  return {
    partnerId,
    fromTier,
    toTier: fromTier,
    activeReferrals: activeCount,
    reason: "grace_continues",
  };
}

/**
 * Garante que existe um Partner row para o user.
 * Útil quando o usuário cruza pela primeira vez o threshold do Suite,
 * ou quando o admin promove manualmente.
 */
export async function ensurePartner(
  userId: string,
  initial: { status?: PartnerStatus; tier?: PartnerTier; manual?: boolean; promotedByAdminId?: string } = {},
): Promise<Partner> {
  const existing = await prisma.partner.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.partner.create({
    data: {
      userId,
      status: initial.status ?? PartnerStatus.ELIGIBLE,
      tier: initial.tier ?? null,
      manualTierOverride: initial.manual ?? false,
      promotedByAdminId: initial.promotedByAdminId ?? null,
      activatedAt:
        initial.status === PartnerStatus.ACTIVE ? new Date() : null,
      tierAchievedAt: initial.tier ? new Date() : null,
    },
  });
}

// ─── Helpers numéricos ───────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function currentCycleYearMonth(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function nextPayoutDate(
  cycleYearMonth: string,
  payoutDayOfMonth: number,
): Date {
  const [yStr, mStr] = cycleYearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr); // 1-12
  // Próximo mês (pagamento ocorre no mês seguinte)
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return new Date(Date.UTC(ny, nm - 1, payoutDayOfMonth, 12, 0, 0));
}
