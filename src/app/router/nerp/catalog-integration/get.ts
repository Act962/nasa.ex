import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { readNerpScopes, type StoredNerpConfig } from "@/features/nerp/lib/credentials";
import { NERP_CATALOG_ORDER_SCOPE } from "@/features/nerp-catalog/lib/constants";
import { buildAsaasWebhookUrl } from "@/features/nerp-catalog/lib/asaas-webhook-url";

export const getNerpCatalogIntegration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canView"))
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const organizationId = context.org.id;
    const [connection, settings, trackings, openOrders] = await Promise.all([
      prisma.platformIntegration.findUnique({
        where: {
          organizationId_platform: { organizationId, platform: IntegrationPlatform.NERP },
        },
        select: { isActive: true, config: true },
      }),
      prisma.nerpCatalogIntegration.findUnique({ where: { organizationId } }),
      prisma.tracking.findMany({
        where: { organizationId, isArchived: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          globalAiActive: true,
          status: { orderBy: { order: "asc" }, select: { id: true, name: true } },
        },
      }),
      prisma.catalogOrder.count({
        where: { organizationId, status: { notIn: ["DELIVERED", "CANCELED"] } },
      }),
    ]);

    const scopes = readNerpScopes((connection?.config ?? null) as StoredNerpConfig | null);

    return {
      connection: {
        isConnected: !!connection?.isActive,
        scopes,
        hasOrderScope: scopes.includes(NERP_CATALOG_ORDER_SCOPE),
      },
      settings: settings
        ? {
            isActive: settings.isActive,
            ordersTrackingId: settings.ordersTrackingId,
            ordersStatusId: settings.ordersStatusId,
            logisticsTrackingId: settings.logisticsTrackingId,
            logisticsStatusId: settings.logisticsStatusId,
            whatsappNumber: settings.whatsappNumber,
            asaasEnv: settings.asaasEnv === "sandbox" ? ("sandbox" as const) : ("production" as const),
            asaasApiKeyLast4: settings.asaasApiKeyLast4,
            hasAsaasKey: !!settings.asaasApiKey,
            isWebhookConfigured: !!settings.asaasWebhookId,
          }
        : null,
      trackings: trackings.map((tracking) => ({
        id: tracking.id,
        name: tracking.name,
        isAiActive: tracking.globalAiActive,
        statuses: tracking.status,
      })),
      webhookUrl: buildAsaasWebhookUrl(organizationId),
      openOrders,
    };
  });
