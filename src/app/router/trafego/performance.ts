import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import {
  PERFORMANCE_BREAKDOWNS,
  PERFORMANCE_RANGES,
  resolvePerformancePeriod,
} from "@/features/trafego/lib/order-meta-metrics";
import {
  resolveOrderMetaAccess,
  toOrderMetaUnavailable,
} from "@/features/trafego/server/lib/meta/order-meta-access";
import {
  getAccountBreakdown,
  getAccountOverview,
  getOrderBudgetUsage,
} from "@/features/trafego/server/lib/meta/order-meta-performance";
import { getOrderAdsPerformance } from "@/features/trafego/server/lib/meta/order-ads-performance";
import { describeMetaAccountStatus } from "@/features/integrations/lib/meta-connection-check";
import { isComplementSent } from "@/features/trafego/lib/complement";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import {
  getTrafegoBillingLock,
  loadOrderComplements,
  readServiceSpend,
  toComplementView,
} from "@/features/trafego/server/lib/service-fee-complement";

/**
 * Desempenho pela conta de anúncios do cliente (spec 0122, RF-11..RF-15).
 * A posse do pedido é conferida ANTES de qualquer chamada à Meta (CA-3).
 * Pedido sem integração na org devolve `mode: "legacy"` e o painel usa `getOrderPerformance`.
 */

async function loadOwnedOrder(orderId: string, organizationId: string) {
  const order = await prisma.trafegoOrder.findFirst({
    where: { id: orderId, organizationId },
    select: {
      id: true,
      code: true,
      organizationId: true,
      platform: true,
      adBudgetBrlCents: true,
      metaCampaignExternalId: true,
      startedAt: true,
      createdAt: true,
    },
  });
  if (!order) throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
  return order;
}

/**
 * Período de teste interno da nota (spec 0128, RF-14): até `TRAFEGO_QUALITY_SCORE_PUBLIC=true`,
 * só admin do sistema vê. Remover o flag depois de 2 semanas conferidas em 3 clientes.
 */
export async function canSeeQualityScore(userId: string): Promise<boolean> {
  if (process.env.TRAFEGO_QUALITY_SCORE_PUBLIC === "true") return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isSystemAdmin: true } });
  return user?.isSystemAdmin === true;
}

const orderInput = z.object({ orderId: z.string().min(1) });
const rangeSchema = z.enum(PERFORMANCE_RANGES).default("order");

export const getTrafegoOrderBudget = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(orderInput)
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);
    if (order.platform !== "META_ADS") return { mode: "legacy" as const };

    const access = await resolveOrderMetaAccess(order);
    if (access.mode !== "account") return access;
    try {
      const budget = await getOrderBudgetUsage(access, order);
      return { mode: "account" as const, budget };
    } catch (budgetError) {
      return toOrderMetaUnavailable(budgetError);
    }
  });

export const getTrafegoAccountOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(orderInput.extend({ range: rangeSchema }))
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);
    if (order.platform !== "META_ADS") return { mode: "legacy" as const };

    const access = await resolveOrderMetaAccess(order);
    if (access.mode !== "account") return access;

    const period = resolvePerformancePeriod({
      range: input.range,
      orderStartedAt: order.startedAt,
      orderCreatedAt: order.createdAt,
      timeZone: access.account.timezoneName,
    });
    try {
      const overview = await getAccountOverview(access, order, period);
      return {
        mode: "account" as const,
        account: {
          name: access.account.name,
          currency: access.account.currency,
          accountStatus: access.account.accountStatus,
          statusLabel: describeMetaAccountStatus(access.account.accountStatus),
        },
        period,
        ...overview,
      };
    } catch (overviewError) {
      return toOrderMetaUnavailable(overviewError);
    }
  });

/** Visão da campanha por anúncio (spec 0126, RF-2). */
export const getTrafegoOrderAds = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(orderInput.extend({ range: rangeSchema }))
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);
    if (order.platform !== "META_ADS") return { mode: "legacy" as const };

    const access = await resolveOrderMetaAccess(order);
    if (access.mode !== "account") return access;

    const period = resolvePerformancePeriod({
      range: input.range,
      orderStartedAt: order.startedAt,
      orderCreatedAt: order.createdAt,
      timeZone: access.account.timezoneName,
    });
    try {
      const [performance, isQualityScoreVisible] = await Promise.all([
        getOrderAdsPerformance(access, order, period),
        canSeeQualityScore(context.user.id),
      ]);
      return { mode: "account" as const, currency: access.account.currency, period, isQualityScoreVisible, ...performance };
    } catch (adsError) {
      return toOrderMetaUnavailable(adsError);
    }
  });

export const getTrafegoAccountBreakdown = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(orderInput.extend({ range: rangeSchema, breakdown: z.enum(PERFORMANCE_BREAKDOWNS) }))
  .handler(async ({ input, context }) => {
    const order = await loadOwnedOrder(input.orderId, context.org.id);
    if (order.platform !== "META_ADS") return { mode: "legacy" as const };

    const access = await resolveOrderMetaAccess(order);
    if (access.mode !== "account") return access;

    const period = resolvePerformancePeriod({
      range: input.range,
      orderStartedAt: order.startedAt,
      orderCreatedAt: order.createdAt,
      timeZone: access.account.timezoneName,
    });
    try {
      const rows = await getAccountBreakdown(access, period, input.breakdown);
      return { mode: "account" as const, rows };
    } catch (breakdownError) {
      return toOrderMetaUnavailable(breakdownError);
    }
  });

/** "Taxa sobre o gasto real" do Desempenho (spec 0123, RF-14). O cliente vê só os complementos do próprio pedido. */
export const getTrafegoServiceFee = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(orderInput)
  .handler(async ({ input, context }) => {
    const order = await prisma.trafegoOrder.findFirst({
      where: { id: input.orderId, organizationId: context.org.id },
      select: {
        id: true,
        code: true,
        organizationId: true,
        platform: true,
        adBudgetBrlCents: true,
        adBudgetPaidToMeta: true,
        serviceFeeBrlCents: true,
        startedAt: true,
        endsAt: true,
        metaCampaignIdsOutsideService: true,
      },
    });
    if (!order) throw new ORPCError("NOT_FOUND", { message: "Campanha não encontrada." });
    if (order.platform !== "META_ADS" || !order.adBudgetPaidToMeta) return { applies: false as const };

    const settings = await loadTrafegoSettings();
    if (!settings.agencyOrganizationId) return { applies: false as const };

    const now = new Date();
    const complements = await loadOrderComplements(order.code, settings.agencyOrganizationId);
    const reading = order.startedAt ? await readServiceSpend(order, complements, now).catch(() => null) : null;
    // Rascunho não aparece para o cliente: ele só vê o que a equipe enviou (D-4).
    const sentComplements = complements
      .filter((complement) => isComplementSent(complement) && complement.status !== "CANCELLED")
      .map((complement) => toComplementView(complement, settings.agencyOrganizationId as string, now));

    return {
      applies: true as const,
      serviceFeeBrlCents: order.serviceFeeBrlCents,
      spentBrlCents: reading?.status === "ok" ? reading.due.spentBrlCents : null,
      dueFeeBrlCents: reading?.status === "ok" ? reading.due.dueFeeBrlCents : null,
      paidBrlCents:
        order.serviceFeeBrlCents + sentComplements.reduce((total, complement) => total + complement.paidBrlCents, 0),
      complements: sentComplements,
    };
  });

/** Trava do painel por complemento enviado e vencido (spec 0123, RF-15). Só banco. */
export const getTrafegoBillingLockProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => getTrafegoBillingLock(context.org.id));
