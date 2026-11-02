import "server-only";

import prisma from "@/lib/prisma";
import type { TrafegoOrderStatus, TrafegoPlatform } from "@/generated/prisma/enums";
import { isOrgOwnerOrAdmin } from "@/features/permissions/server/is-org-admin";
import {
  CAMPAIGN_BUILDER_BLOCK_MESSAGE,
  isCampaignBuilderStatus,
  type CampaignBuilderBlockReason,
} from "@/features/trafego/lib/campaign-builder/builder-rules";
import type { MetaConnectionCheck } from "@/features/integrations/lib/meta-connection-check";
import { hasOverdueTrafegoComplement } from "../service-fee-complement";
import { resolveOrderMetaAccess, type OrderMetaAccess } from "../meta/order-meta-access";

/**
 * Guarda do construtor de campanha (spec 0124, RF-1), conferida no servidor em toda
 * procedure. Os passos baratos (banco) vêm antes da Meta; a conta vem sempre da
 * integração da org do pedido, nunca da entrada (RNF-3).
 */

export const BUILDER_ORDER_SELECT = {
  id: true,
  code: true,
  organizationId: true,
  status: true,
  platform: true,
  businessName: true,
  adBudgetBrlCents: true,
  adBudgetPaidToMeta: true,
  metaCampaignExternalId: true,
  metaAdCampaignId: true,
  startedAt: true,
  durationDays: true,
  maxCreatives: true,
} as const;

export interface BuilderOrder {
  id: string;
  code: string;
  organizationId: string;
  status: TrafegoOrderStatus;
  platform: TrafegoPlatform;
  businessName: string | null;
  adBudgetBrlCents: number;
  adBudgetPaidToMeta: boolean;
  metaCampaignExternalId: string | null;
  metaAdCampaignId: string | null;
  startedAt: Date | null;
  durationDays: number;
  /** Anúncios rodando ao mesmo tempo (spec 0127). */
  maxCreatives: number;
}

export type BuilderAccess =
  | {
      ok: true;
      order: BuilderOrder;
      meta: Extract<OrderMetaAccess, { mode: "account" }>;
      connectionCheck: MetaConnectionCheck;
    }
  | { ok: false; order: BuilderOrder | null; reason: CampaignBuilderBlockReason | "not_found"; message: string };

function blocked(order: BuilderOrder, reason: CampaignBuilderBlockReason, message?: string): BuilderAccess {
  return { ok: false, order, reason, message: message ?? CAMPAIGN_BUILDER_BLOCK_MESSAGE[reason] };
}

export async function resolveCampaignBuilderAccess(params: {
  orderId: string;
  organizationId: string;
  userId: string;
}): Promise<BuilderAccess> {
  const order = await prisma.trafegoOrder.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    select: BUILDER_ORDER_SELECT,
  });
  if (!order) return { ok: false, order: null, reason: "not_found", message: "Campanha não encontrada." };

  if (!(await isOrgOwnerOrAdmin(order.organizationId, params.userId))) return blocked(order, "not_owner_or_admin");
  if (order.platform !== "META_ADS") return blocked(order, "not_meta");

  const integration = await prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId: order.organizationId, platform: "META" } },
    select: { isActive: true, config: true },
  });
  if (!integration?.isActive) return blocked(order, "no_integration");
  const config = (integration.config ?? null) as { connectionCheck?: MetaConnectionCheck } | null;
  const connectionCheck = config?.connectionCheck;
  if (!connectionCheck?.canCreate) return blocked(order, "cannot_create");

  if (!isCampaignBuilderStatus(order.status)) return blocked(order, "order_status");
  if (await hasOverdueTrafegoComplement(order)) return blocked(order, "overdue_complement");

  const meta = await resolveOrderMetaAccess(order);
  if (meta.mode === "legacy") return blocked(order, "no_integration");
  if (meta.mode === "unavailable") return blocked(order, "meta_unavailable", meta.message);
  return { ok: true, order, meta, connectionCheck };
}
