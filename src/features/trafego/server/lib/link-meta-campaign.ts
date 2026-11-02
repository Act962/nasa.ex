import "server-only";

import prisma from "@/lib/prisma";
import { getMetaCampaignTree } from "@/http/meta/ads-builder";
import { resolveOrderMetaAccess, toOrderMetaUnavailable } from "./meta/order-meta-access";
import { forgetMetaReadCacheForOrg } from "./meta/meta-read-cache";

/**
 * Vincula ao pedido a campanha que a equipe criou na Meta (spec 0131, RF-5, CA-7). Confere na conta da
 * empresa do pedido que a campanha existe: id de outra conta é recusado.
 */
export async function linkOrderToMetaCampaign(params: {
  orderId: string;
  metaCampaignId: string;
  actorUserId: string;
  viaLabel: string;
}): Promise<{ ok: true; campaignName: string } | { ok: false; message: string }> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: params.orderId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!order) return { ok: false, message: "Pedido não encontrado." };

  const access = await resolveOrderMetaAccess({ organizationId: order.organizationId });
  if (access.mode === "legacy") return { ok: false, message: "A empresa não conectou a Meta nos Satélites: vincule pelo admin." };
  if (access.mode === "unavailable") return { ok: false, message: access.message };

  const campaignId = params.metaCampaignId.trim();
  let campaignName: string;
  try {
    const tree = await getMetaCampaignTree(access.auth, campaignId);
    const accountId = access.auth.adAccountId.replace(/^act_/, "");
    if (tree.accountId && tree.accountId.replace(/^act_/, "") !== accountId) {
      return { ok: false, message: "Essa campanha não é da conta de anúncios desta empresa." };
    }
    campaignName = tree.name;
  } catch (error) {
    const unavailable = toOrderMetaUnavailable(error);
    return { ok: false, message: `Não achei essa campanha na conta da empresa. ${unavailable.message}` };
  }

  const localCampaign = await prisma.metaAdCampaign.findUnique({ where: { metaCampaignId: campaignId }, select: { id: true } });
  await prisma.$transaction([
    prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { metaCampaignExternalId: campaignId, metaAdCampaignId: localCampaign?.id ?? null },
    }),
    prisma.trafegoOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        title: `Campanha vinculada: ${campaignName}`,
        detail: `Id ${campaignId} · via IA externa · ${params.viaLabel}`,
        isClientVisible: false,
        actorUserId: params.actorUserId,
        source: "ADMIN",
      },
    }),
  ]);
  forgetMetaReadCacheForOrg(order.organizationId);
  return { ok: true, campaignName };
}
