import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";
import { ensureCatalogStages } from "@/features/nerp-catalog/lib/stage-setup";
import { CATALOG_STAGE_KEYS } from "@/features/nerp-catalog/lib/catalog-stages";

// Spec 0044, RF-4: cria as colunas/tags padrão no tracking escolhido e passa a usar só ele
// (pedido chega em "Novo Pedido", pagamento leva a "Pagamento confirmado"). Não apaga nada.
export const applyDefaultCatalogStages = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canEdit"))
  .input(z.object({ trackingId: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const tracking = await prisma.tracking.findFirst({
      where: { id: input.trackingId, organizationId },
      select: { id: true, name: true },
    });
    if (!tracking) throw errors.BAD_REQUEST({ message: "Tracking inválido para esta organização." });

    const integration = await prisma.nerpCatalogIntegration.findUnique({ where: { organizationId }, select: { id: true } });
    if (!integration) {
      throw errors.BAD_REQUEST({ message: "Salve a configuração do Catálogo online antes de aplicar o padrão." });
    }

    const statusIdByKey = await ensureCatalogStages({ organizationId, trackingId: tracking.id });
    await prisma.nerpCatalogIntegration.update({
      where: { organizationId },
      data: {
        ordersTrackingId: tracking.id,
        ordersStatusId: statusIdByKey[CATALOG_STAGE_KEYS.new],
        logisticsTrackingId: tracking.id,
        logisticsStatusId: statusIdByKey[CATALOG_STAGE_KEYS.paid],
      },
    });
    return {
      trackingId: tracking.id,
      trackingName: tracking.name,
      ordersStatusId: statusIdByKey[CATALOG_STAGE_KEYS.new],
      logisticsStatusId: statusIdByKey[CATALOG_STAGE_KEYS.paid],
    };
  });
