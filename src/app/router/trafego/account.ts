import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import {
  ACCOUNT_RANGES,
  PERFORMANCE_BREAKDOWNS,
  resolveAccountSelection,
  type AccountPeriodSelection,
} from "@/features/trafego/lib/order-meta-metrics";
import { extractOrderCodes } from "@/features/trafego/lib/campaign-code";
import { describeMetaAccountStatus } from "@/features/integrations/lib/meta-connection-check";
import {
  resolveOrderMetaAccess,
  toOrderMetaUnavailable,
} from "@/features/trafego/server/lib/meta/order-meta-access";
import { getAccountCampaigns } from "@/features/trafego/server/lib/meta/account-campaigns";
import { getAccountBreakdown } from "@/features/trafego/server/lib/meta/order-meta-performance";
import { getCampaignAdsPerformance } from "@/features/trafego/server/lib/meta/order-ads-performance";
import { canSeeQualityScore } from "./performance";

/**
 * Visão da conta de anúncios inteira no painel do trafeGO: todas as campanhas,
 * conjuntos e anúncios, inclusive os criados fora do sistema. Só lê a integração
 * Meta da org de quem pede; sem integração devolve `mode: "not_connected"`.
 */

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Atalho (`range`) ou período do calendário (`range: "custom"` + `since`/`until`). */
const periodInput = z.object({
  range: z.enum([...ACCOUNT_RANGES, "custom"]).default("last_30d"),
  since: dateOnly.optional(),
  until: dateOnly.optional(),
});

function resolvePeriod(input: z.infer<typeof periodInput>, timeZone: string | null) {
  const selection: AccountPeriodSelection =
    input.range === "custom"
      ? { range: "custom", since: input.since ?? "", until: input.until ?? "" }
      : { range: input.range };
  const period = resolveAccountSelection({ selection, timeZone });
  if (!period) {
    throw new ORPCError("BAD_REQUEST", { message: "Período inválido: confira as datas escolhidas." });
  }
  return period;
}

async function resolveAccountAccess(organizationId: string) {
  const access = await resolveOrderMetaAccess({ organizationId });
  if (access.mode === "legacy") return { mode: "not_connected" as const };
  return access;
}

export const getTrafegoAccountCampaigns = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(periodInput)
  .handler(async ({ input, context }) => {
    const access = await resolveAccountAccess(context.org.id);
    if (access.mode !== "account") return access;

    const period = resolvePeriod(input, access.account.timezoneName);
    try {
      const [result, orders] = await Promise.all([
        getAccountCampaigns(access, period),
        prisma.trafegoOrder.findMany({
          where: { organizationId: context.org.id },
          select: { id: true, code: true, metaCampaignExternalId: true },
        }),
      ]);
      const orderByCode = new Map(orders.map((order) => [order.code.toUpperCase(), order]));
      const orderByCampaignId = new Map(
        orders
          .filter((order) => order.metaCampaignExternalId)
          .map((order) => [order.metaCampaignExternalId as string, order]),
      );

      return {
        mode: "account" as const,
        account: {
          name: access.account.name,
          currency: access.account.currency,
          accountStatus: access.account.accountStatus,
          statusLabel: describeMetaAccountStatus(access.account.accountStatus),
        },
        period,
        ...result,
        campaigns: result.campaigns.map((campaign) => {
          // Nome com mais de um código é ambíguo: não liga a nenhum pedido.
          const codes = extractOrderCodes(campaign.name);
          const order =
            orderByCampaignId.get(campaign.id) ?? (codes.length === 1 ? orderByCode.get(codes[0]) : undefined);
          return { ...campaign, order: order ? { id: order.id, code: order.code } : null };
        }),
      };
    } catch (campaignsError) {
      return toOrderMetaUnavailable(campaignsError);
    }
  });

export const getTrafegoAccountCampaignAds = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(periodInput.extend({ campaignId: z.string().regex(/^\d+$/) }))
  .handler(async ({ input, context }) => {
    const access = await resolveAccountAccess(context.org.id);
    if (access.mode !== "account") return access;

    const period = resolvePeriod(input, access.account.timezoneName);
    try {
      const [performance, isQualityScoreVisible] = await Promise.all([
        getCampaignAdsPerformance(access, input.campaignId, period),
        canSeeQualityScore(context.user.id),
      ]);
      if (!performance) {
        return {
          mode: "unavailable" as const,
          reason: "no_access" as const,
          message: "Esta campanha não é da conta de anúncios conectada.",
        };
      }
      return { mode: "account" as const, currency: access.account.currency, period, isQualityScoreVisible, ...performance };
    } catch (adsError) {
      return toOrderMetaUnavailable(adsError);
    }
  });

export const getTrafegoAccountWideBreakdown = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(periodInput.extend({ breakdown: z.enum(PERFORMANCE_BREAKDOWNS) }))
  .handler(async ({ input, context }) => {
    const access = await resolveAccountAccess(context.org.id);
    if (access.mode !== "account") return access;

    const period = resolvePeriod(input, access.account.timezoneName);
    try {
      const rows = await getAccountBreakdown(access, period, input.breakdown);
      return { mode: "account" as const, rows };
    } catch (breakdownError) {
      return toOrderMetaUnavailable(breakdownError);
    }
  });
