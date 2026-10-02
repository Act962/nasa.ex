// Dados do painel "Número e gastos" (spec 0040, RF-8): saúde do número,
// limite diário e gasto do mês por categoria (`pricing_analytics`).

import "server-only";
import prisma from "@/lib/prisma";
import { getPhoneNumbers, getPricingAnalytics } from "@/http/whats-oficial";
import {
  howToReachNextLevel,
  nextMessagingLimit,
  resolveMessagingLimit,
} from "@/features/campanhas/lib/messaging-limits";
import {
  metaBillingActivityUrl,
  metaBusinessVerificationUrl,
  metaPaymentMethodsUrl,
  metaWhatsAppManagerUrl,
} from "@/features/campanhas/lib/meta-links";
import { resolveCampaignMetaCredentials } from "./broadcast-access";
import { remainingDailyContacts } from "./daily-quota";

export interface SpendByCategory {
  category: string;
  volume: number;
  cost: number;
}

function startOfMonthUnix(now: Date): number {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
}

export async function loadMetaNumberPanel(trackingId: string, organizationId: string) {
  const credentials = await resolveCampaignMetaCredentials(trackingId, organizationId);
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { trackingId },
    select: { metaBusinessId: true },
  });
  const now = new Date();

  const [phoneResult, pricingResult, orbitaFeesResult] = await Promise.allSettled([
    getPhoneNumbers({ wabaId: credentials.wabaId, accessToken: credentials.accessToken }),
    getPricingAnalytics({
      wabaId: credentials.wabaId,
      accessToken: credentials.accessToken,
      startUnix: startOfMonthUnix(now),
      endUnix: Math.floor(now.getTime() / 1000),
    }),
    prisma.broadcastFeePayment.aggregate({
      where: {
        organizationId,
        status: "PAID",
        paidAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        broadcast: { trackingId },
      },
      _sum: { serviceFeeBrlCents: true },
    }),
  ]);

  const phone =
    phoneResult.status === "fulfilled"
      ? (phoneResult.value.data.find((number) => number.id === credentials.phoneNumberId) ?? phoneResult.value.data[0] ?? null)
      : null;
  const limit = resolveMessagingLimit(phone?.messaging_limit_tier);

  const spendMap = new Map<string, SpendByCategory>();
  let currency: string | null = null;
  if (pricingResult.status === "fulfilled") {
    currency = pricingResult.value.currency ?? null;
    const points = pricingResult.value.pricing_analytics?.data?.flatMap((entry) => entry.data_points ?? []) ?? [];
    for (const point of points) {
      const category = point.pricing_category ?? "OUTROS";
      const current = spendMap.get(category) ?? { category, volume: 0, cost: 0 };
      current.volume += point.volume ?? 0;
      current.cost += point.cost ?? 0;
      spendMap.set(category, current);
    }
  }
  const spend = [...spendMap.values()].sort((first, second) => second.cost - first.cost);

  const refs = { businessId: instance?.metaBusinessId ?? null, wabaId: credentials.wabaId };
  return {
    phone: phone
      ? {
          displayNumber: phone.display_phone_number,
          verifiedName: phone.verified_name,
          quality: phone.quality_rating ?? "UNKNOWN",
        }
      : null,
    limit,
    remainingToday: await remainingDailyContacts(trackingId, limit, now),
    nextLimit: nextMessagingLimit(limit),
    howToReachNextLimit: howToReachNextLevel(limit),
    spend: {
      isAvailable: pricingResult.status === "fulfilled",
      currency,
      total: spend.reduce((sum, item) => sum + item.cost, 0),
      byCategory: spend,
    },
    orbitaFees: {
      isAvailable: orbitaFeesResult.status === "fulfilled",
      totalBrl:
        orbitaFeesResult.status === "fulfilled" ? (orbitaFeesResult.value._sum.serviceFeeBrlCents ?? 0) / 100 : 0,
    },
    links: {
      paymentMethods: metaPaymentMethodsUrl(refs),
      billingActivity: metaBillingActivityUrl(refs),
      whatsappManager: metaWhatsAppManagerUrl(refs),
      businessVerification: metaBusinessVerificationUrl(refs),
      hasBusinessId: Boolean(refs.businessId),
    },
  };
}
