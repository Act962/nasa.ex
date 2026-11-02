import "server-only";

import { updateMetaObject } from "@/http/meta/ads-builder";
import { countRunningAds, runningAdsLimitMessage } from "@/features/trafego/lib/creative-limits";
import { forgetMetaReadCacheForOrg } from "../meta/meta-read-cache";
import type { BuilderOrder } from "./builder-access";
import { CampaignBuilderError, listOrderCampaigns, type AccountMeta } from "./builder-context";
import { recordBuilderEffects, toUserMessage, type BuilderActor } from "./builder-actions";

/**
 * Liga e desliga conjunto de anúncios ou anúncio pelo cartão do painel (spec 0126).
 * Só objetos das campanhas do pedido; ativar confere o limite de anúncios no ar (spec 0127).
 */

export interface DeliveryChange {
  objectType: "adset" | "ad";
  objectId: string;
  isActive: boolean;
}

export async function setOrderDeliveryStatus(
  meta: AccountMeta,
  order: BuilderOrder,
  change: DeliveryChange,
  actor: BuilderActor,
) {
  const campaigns = await listOrderCampaigns(meta, order);
  const campaign = campaigns.find((tree) =>
    change.objectType === "adset"
      ? tree.adsets.some((adset) => adset.id === change.objectId)
      : tree.ads.some((ad) => ad.id === change.objectId),
  );
  if (!campaign) throw new CampaignBuilderError("NOT_FOUND", "Este anúncio não é das campanhas deste pedido.");

  const adset = change.objectType === "adset" ? campaign.adsets.find((item) => item.id === change.objectId) : null;
  const ad = change.objectType === "ad" ? campaign.ads.find((item) => item.id === change.objectId) : null;
  const objectName = adset?.name ?? ad?.name ?? change.objectId;

  if (change.isActive) {
    const adsToActivate =
      change.objectType === "adset"
        ? campaign.ads.filter((item) => item.adsetId === change.objectId && item.status === "ACTIVE").length
        : 1;
    const runningAds = countRunningAds(campaigns, {
      excludeAdsetId: change.objectType === "adset" ? change.objectId : undefined,
      excludeAdId: change.objectType === "ad" ? change.objectId : undefined,
    });
    if (runningAds + adsToActivate > order.maxCreatives) {
      throw new CampaignBuilderError("BAD_REQUEST", runningAdsLimitMessage(order.maxCreatives));
    }
  }

  try {
    await updateMetaObject(meta.auth, change.objectId, { status: change.isActive ? "ACTIVE" : "PAUSED" });
  } catch (error) {
    throw new CampaignBuilderError("BAD_REQUEST", `A Meta não aceitou a mudança: ${toUserMessage(error)}`);
  } finally {
    forgetMetaReadCacheForOrg(meta.organizationId);
  }

  const kindLabel = change.objectType === "adset" ? "Conjunto de anúncios" : "Anúncio";
  await recordBuilderEffects({
    order,
    actor,
    title: `${kindLabel} ${change.isActive ? "ativado" : "pausado"}`,
    detail: objectName,
    action: change.isActive ? "trafego.delivery.activate" : "trafego.delivery.pause",
    metadata: { objectType: change.objectType, objectId: change.objectId },
  });
  return { isActive: change.isActive };
}
