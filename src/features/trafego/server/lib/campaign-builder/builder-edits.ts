import "server-only";

import { getMetaCampaignTree, createMetaObject, updateMetaObject } from "@/http/meta/ads-builder";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { formatDateInTimeZone } from "@/features/trafego/lib/order-meta-metrics";
import {
  buildAdPayload,
  buildCreativePayload,
  buildTargeting,
  type AudienceDraft,
} from "@/features/trafego/lib/campaign-builder/build-meta-payloads";
import { buildEndTimeIso, estimateBudgetComplement } from "@/features/trafego/lib/campaign-builder/builder-rules";
import type { BuilderOrder } from "./builder-access";
import {
  CampaignBuilderError,
  assertRunningAdsLimit,
  requireBuilderPage,
  requireOrderCampaign,
  type AccountMeta,
} from "./builder-context";
import {
  assertAdTextAllowed,
  mirrorCampaign,
  recordBuilderEffects,
  resolveAdSource,
  toUserMessage,
  type BuilderActor,
  type BuilderAdSourceInput,
} from "./builder-actions";

/** Edição das campanhas do pedido pelo painel (spec 0124, RF-10): descartar, pausar, verba, fim, público e anúncio. */

/** Descartar rascunho = arquivar a campanha pausada. Nunca apaga. */
export async function discardCampaignDraft(meta: AccountMeta, order: BuilderOrder, campaignId: string, actor: BuilderActor) {
  const campaign = await requireOrderCampaign(meta, order, campaignId);
  if (campaign.status === "ACTIVE") {
    throw new CampaignBuilderError("BAD_REQUEST", "Pause a campanha antes de descartar.");
  }
  await updateMetaObject(meta.auth, campaign.id, { status: "ARCHIVED" });
  await recordBuilderEffects({
    order,
    actor,
    title: "Rascunho de campanha descartado",
    detail: `${campaign.name} foi arquivada`,
    action: "trafego.campaign_draft_discarded",
    metadata: { campaignId: campaign.id },
  });
  return { ok: true };
}

export type CampaignUpdateInput =
  | { action: "pause" | "resume" }
  | { action: "budget"; lifetimeBudgetBrlCents: number; isComplementConfirmed: boolean }
  | { action: "end_date"; endDate: string }
  | { action: "audience"; audience: AudienceDraft };

const UPDATE_TITLE: Record<CampaignUpdateInput["action"], string> = {
  pause: "Campanha pausada",
  resume: "Campanha retomada",
  budget: "Verba da campanha alterada",
  end_date: "Data de fim alterada",
  audience: "Público alterado",
};

/** Edição das campanhas do pedido (RF-10). Público passa por revisão da Meta de novo; verba e datas, não. */
export async function updateOrderCampaign(
  meta: AccountMeta,
  order: BuilderOrder,
  campaignId: string,
  input: CampaignUpdateInput,
  actor: BuilderActor,
) {
  const campaign = await requireOrderCampaign(meta, order, campaignId);
  const liveAdsets = campaign.adsets.filter((adset) => adset.status !== "ARCHIVED" && adset.status !== "DELETED");
  let detail = campaign.name;

  if (input.action === "resume") {
    const adsToActivate = campaign.ads.filter((ad) => ad.status === "ACTIVE").length;
    await assertRunningAdsLimit(meta, order, { campaignId: campaign.id, adsToActivate });
  }

  try {
    if (input.action === "pause" || input.action === "resume") {
      await updateMetaObject(meta.auth, campaign.id, { status: input.action === "pause" ? "PAUSED" : "ACTIVE" });
    } else if (input.action === "budget") {
      const currentBudget = campaign.lifetimeBudgetCents ?? 0;
      const estimate = estimateBudgetComplement({
        budgetBrlCents: Math.max(0, input.lifetimeBudgetBrlCents - currentBudget),
        declaredBudgetBrlCents: order.adBudgetBrlCents,
        spentBrlCents: currentBudget,
      });
      if (estimate.needsConfirmation && !input.isComplementConfirmed) {
        throw new CampaignBuilderError(
          "BAD_REQUEST",
          `A verba nova passa do declarado em ${formatBrlFromCents(estimate.excessBrlCents)}: confirme o complemento estimado de ${formatBrlFromCents(estimate.estimatedComplementBrlCents)}.`,
        );
      }
      await updateMetaObject(meta.auth, campaign.id, { lifetime_budget: input.lifetimeBudgetBrlCents });
      detail = `${campaign.name} · ${formatBrlFromCents(currentBudget)} → ${formatBrlFromCents(input.lifetimeBudgetBrlCents)}`;
    } else if (input.action === "end_date") {
      const today = formatDateInTimeZone(new Date(), meta.account.timezoneName);
      if (input.endDate <= today) throw new CampaignBuilderError("BAD_REQUEST", "A data de fim precisa ser depois de hoje.");
      const endTimeIso = buildEndTimeIso(input.endDate, meta.account.timezoneName);
      for (const adset of liveAdsets) await updateMetaObject(meta.auth, adset.id, { end_time: endTimeIso });
      detail = `${campaign.name} · até ${input.endDate.split("-").reverse().join("/")}`;
    } else if (input.action === "audience") {
      const targeting = buildTargeting(input.audience);
      for (const adset of liveAdsets) await updateMetaObject(meta.auth, adset.id, { targeting });
      detail = `${campaign.name} · ${input.audience.cityName} + ${input.audience.radiusKm} km, ${input.audience.ageMin}–${input.audience.ageMax} anos`;
    }
  } catch (error) {
    if (error instanceof CampaignBuilderError) throw error;
    throw new CampaignBuilderError("BAD_REQUEST", `A Meta não aceitou a mudança: ${toUserMessage(error)}`);
  }

  const updated = await getMetaCampaignTree(meta.auth, campaign.id);
  await mirrorCampaign(meta, order, updated, actor.id);
  await recordBuilderEffects({
    order,
    actor,
    title: UPDATE_TITLE[input.action],
    detail,
    action: `trafego.campaign_${input.action}`,
    metadata: { campaignId: campaign.id },
  });
  return { campaign: updated, needsReview: input.action === "audience" };
}

/** Criativo não se edita: anúncio novo no lugar e o antigo pausado (CA-9). */
export async function replaceCampaignAd(
  meta: AccountMeta,
  order: BuilderOrder,
  params: { campaignId: string; source: BuilderAdSourceInput; isPolicyWarningConfirmed: boolean },
  actor: BuilderActor,
) {
  const campaign = await requireOrderCampaign(meta, order, params.campaignId);
  const adset = campaign.adsets.find((item) => item.status !== "ARCHIVED" && item.status !== "DELETED" && item.pageId);
  if (!adset?.pageId) throw new CampaignBuilderError("BAD_REQUEST", "A campanha não tem conjunto ativo para receber o anúncio.");

  const page = await requireBuilderPage(meta, adset.pageId);
  const { source, text } = await resolveAdSource(meta, order, page, params.source);
  assertAdTextAllowed(text, params.isPolicyWarningConfirmed);

  const oldAds = campaign.ads.filter((ad) => ad.adsetId === adset.id && ad.status !== "ARCHIVED" && ad.status !== "DELETED");
  const wasActive = oldAds.some((ad) => ad.status === "ACTIVE");
  try {
    const creative = await createMetaObject(meta.auth, meta.auth.adAccountId, "adcreatives", buildCreativePayload({
      name: `${order.code} — Criativo ${new Date().toISOString().slice(0, 10)}`,
      pageId: page.id,
      instagramUserId: page.instagramUserId,
      source,
    }));
    await createMetaObject(meta.auth, meta.auth.adAccountId, "ads", {
      ...buildAdPayload({ name: `${order.code} — Anúncio`, adsetId: adset.id, creativeId: creative.id }),
      status: wasActive ? "ACTIVE" : "PAUSED",
    });
    for (const oldAd of oldAds) await updateMetaObject(meta.auth, oldAd.id, { status: "PAUSED" });
  } catch (error) {
    throw new CampaignBuilderError("BAD_REQUEST", `A Meta não aceitou o anúncio novo: ${toUserMessage(error)}`);
  }

  const updated = await getMetaCampaignTree(meta.auth, campaign.id);
  await recordBuilderEffects({
    order,
    actor,
    title: "Anúncio trocado",
    detail: `${campaign.name} · ${oldAds.length} anúncio(s) anterior(es) pausado(s)`,
    action: "trafego.campaign_ad_replaced",
    metadata: { campaignId: campaign.id, sourceKind: params.source.kind },
  });
  return { campaign: updated };
}
