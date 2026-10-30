import "server-only";

import prisma from "@/lib/prisma";
import { getPublicMediaUrl } from "@/lib/r2-url";
import { logActivity } from "@/features/admin/lib/activity-logger";
import {
  createMetaObject,
  getInstagramMedia,
  getMetaCampaignTree,
  updateMetaObject,
  uploadMetaAdImage,
  type MetaCampaignTree,
} from "@/http/meta/ads-builder";
import { MetaGraphError } from "@/http/meta/graph-client";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { formatDateInTimeZone } from "@/features/trafego/lib/order-meta-metrics";
import { prescreenAdContent } from "@/features/trafego/lib/ad-policies";
import {
  buildAdPayload,
  buildAdSetPayload,
  buildCampaignName,
  buildCampaignPayload,
  buildCreativePayload,
  extractDraftKey,
  isValidDraftKey,
  type AdSource,
  type AudienceDraft,
} from "@/features/trafego/lib/campaign-builder/build-meta-payloads";
import {
  buildEndTimeIso,
  countCampaignDays,
  estimateBudgetComplement,
  isBelowMinDailyBudget,
} from "@/features/trafego/lib/campaign-builder/builder-rules";
import { notifyTrafegoAdmins } from "../trafego-alerts";
import { transitionTrafegoOrder } from "../transition-order";
import { getOrderBudgetUsage } from "../meta/order-meta-performance";
import type { BuilderOrder } from "./builder-access";
import {
  CampaignBuilderError,
  listOrderCampaigns,
  requireBuilderPage,
  requireOrderCampaign,
  type AccountMeta,
  type BuilderPage,
} from "./builder-context";

/**
 * Escritas do construtor (spec 0124, RF-8..RF-12). Tudo nasce PAUSADO, nada é apagado
 * (só arquivado) e os efeitos (evento, log, aviso) rodam depois da Meta responder.
 */

export interface BuilderActor {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export type BuilderAdSourceInput =
  | { kind: "instagram_post"; mediaId: string }
  | { kind: "image"; creativeId: string; copyId: string };

export function toUserMessage(error: unknown): string {
  if (error instanceof MetaGraphError) return error.userMessage;
  if (error instanceof CampaignBuilderError) return error.message;
  return "A Meta não aceitou o pedido agora. Tente de novo em alguns minutos.";
}

export async function recordBuilderEffects(params: {
  order: BuilderOrder;
  actor: BuilderActor;
  title: string;
  detail: string;
  action: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  try {
    await prisma.trafegoOrderEvent.create({
      data: {
        orderId: params.order.id,
        fromStatus: params.order.status,
        toStatus: params.order.status,
        title: params.title,
        detail: `${params.detail} · por ${params.actor.name || params.actor.email}`,
        isClientVisible: true,
        actorUserId: params.actor.id,
        source: "CLIENT",
      },
    });
  } catch (error) {
    console.error("[trafego/campaign-builder] evento não gravado:", error);
  }
  await logActivity({
    organizationId: params.order.organizationId,
    userId: params.actor.id,
    userName: params.actor.name,
    userEmail: params.actor.email,
    userImage: params.actor.image,
    appSlug: "trafego",
    action: params.action,
    actionLabel: `${params.title} (${params.order.code})`,
    resource: params.order.code,
    resourceId: params.order.id,
    metadata: params.metadata,
  });
}

/** Espelho em `MetaAdCampaign` e vínculo do pedido, se ainda não tem (RF-12). Best-effort. */
export async function mirrorCampaign(meta: AccountMeta, order: BuilderOrder, campaign: MetaCampaignTree, actorId: string) {
  try {
    const existing = await prisma.metaAdCampaign.findUnique({
      where: { metaCampaignId: campaign.id },
      select: { id: true, organizationId: true },
    });
    if (existing && existing.organizationId !== order.organizationId) return;
    const status = campaign.status === "ACTIVE" ? "ACTIVE" : campaign.status === "ARCHIVED" ? "ARCHIVED" : "PAUSED";
    const data = {
      name: campaign.name,
      objective: "OUTCOME_ENGAGEMENT",
      status,
      effectiveStatus: campaign.effectiveStatus,
      lifetimeBudget: campaign.lifetimeBudgetCents !== null ? campaign.lifetimeBudgetCents / 100 : null,
      bidStrategy: "LOWEST_COST_WITHOUT_CAP",
      lastSyncedAt: new Date(),
    } as const;
    const mirrored = existing
      ? await prisma.metaAdCampaign.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.metaAdCampaign.create({
          data: {
            ...data,
            organizationId: order.organizationId,
            metaCampaignId: campaign.id,
            adAccountId: meta.auth.adAccountId,
            buyingType: "AUCTION",
            createdByUserId: actorId,
          },
          select: { id: true },
        });
    if (!order.metaCampaignExternalId) {
      await prisma.trafegoOrder.updateMany({
        where: { id: order.id, metaCampaignExternalId: null },
        data: { metaCampaignExternalId: campaign.id, metaAdCampaignId: mirrored.id },
      });
    }
  } catch (error) {
    console.error("[trafego/campaign-builder] espelho da campanha falhou:", error);
  }
}

/** Texto do anúncio, relido no servidor, e a origem pronta para o payload. */
export async function resolveAdSource(
  meta: AccountMeta,
  order: BuilderOrder,
  page: BuilderPage,
  sourceInput: BuilderAdSourceInput,
): Promise<{ source: AdSource; text: string }> {
  if (sourceInput.kind === "instagram_post") {
    if (!page.instagramUserId) throw new CampaignBuilderError("BAD_REQUEST", "A página não tem Instagram ligado.");
    const media = await getInstagramMedia(meta.auth, sourceInput.mediaId);
    if (media.ownerId && media.ownerId !== page.instagramUserId) {
      throw new CampaignBuilderError("BAD_REQUEST", "Este post não é do Instagram da página escolhida.");
    }
    return { source: { kind: "instagram_post", mediaId: media.id }, text: media.caption ?? "" };
  }

  const [creative, copy] = await Promise.all([
    prisma.trafegoCreative.findFirst({
      where: { id: sourceInput.creativeId, orderId: order.id, kind: "IMAGE", status: { not: "REJECTED" } },
      select: { fileKey: true, fileName: true, mimeType: true },
    }),
    prisma.trafegoCopy.findFirst({
      where: { id: sourceInput.copyId, orderId: order.id },
      select: { headline: true, primaryText: true },
    }),
  ]);
  if (!creative || !copy) throw new CampaignBuilderError("BAD_REQUEST", "Imagem ou texto não encontrado nos Materiais.");

  const response = await fetch(await getPublicMediaUrl(creative.fileKey), { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new CampaignBuilderError("BAD_REQUEST", "Não foi possível ler a imagem dos Materiais.");
  const bytes = Buffer.from(await response.arrayBuffer());
  const { hash } = await uploadMetaAdImage(meta.auth, meta.auth.adAccountId, {
    bytesBase64: bytes.toString("base64"),
    fileName: creative.fileName ?? `${order.code}.jpg`,
  });
  return {
    source: { kind: "image", imageHash: hash, message: copy.primaryText, headline: copy.headline },
    text: [copy.headline, copy.primaryText].filter(Boolean).join("\n"),
  };
}

/** Políticas antes de ir à Meta: BLOCKED não segue; WARNING pede confirmação (RF-5, CA-6). */
export function assertAdTextAllowed(text: string, isWarningConfirmed: boolean) {
  const prescreen = prescreenAdContent({ platform: "META_ADS", texts: [text] });
  const blockedHit = prescreen.hits.find((hit) => hit.level === "BLOCKED");
  if (blockedHit) throw new CampaignBuilderError("BAD_REQUEST", `${blockedHit.label}: ${blockedHit.reason} ${blockedHit.fix}`);
  const warningHit = prescreen.hits.find((hit) => hit.level === "WARNING");
  if (warningHit && !isWarningConfirmed) {
    throw new CampaignBuilderError("BAD_REQUEST", `${warningHit.label}: ${warningHit.reason} Confirme o aviso para seguir.`);
  }
}

export interface CreateDraftInput {
  draftKey: string;
  pageId: string;
  audience: AudienceDraft;
  source: BuilderAdSourceInput;
  budgetBrlCents: number;
  endDate: string;
  isComplementConfirmed: boolean;
  isPolicyWarningConfirmed: boolean;
}

/** Campanha → conjunto → criativo → anúncio, tudo PAUSADO. Falhou no meio: arquiva o que nasceu (CA-5). */
export async function createCampaignDraft(meta: AccountMeta, order: BuilderOrder, input: CreateDraftInput, actor: BuilderActor) {
  if (!isValidDraftKey(input.draftKey)) throw new CampaignBuilderError("BAD_REQUEST", "Chave do rascunho inválida.");
  if (meta.account.currency.toUpperCase() !== "BRL") {
    throw new CampaignBuilderError("BAD_REQUEST", `A conta é em ${meta.account.currency}: a verba do trafeGO é em reais.`);
  }

  // Clique duplo ou retomada: a campanha com a mesma chave já existe na conta (CA-4).
  const sameKey = (await listOrderCampaigns(meta, order)).find(
    (campaign) => extractDraftKey(campaign.name) === input.draftKey,
  );
  if (sameKey) return { campaign: sameKey, isExisting: true };

  const page = await requireBuilderPage(meta, input.pageId);
  const today = formatDateInTimeZone(new Date(), meta.account.timezoneName);
  if (input.endDate <= today) throw new CampaignBuilderError("BAD_REQUEST", "A data de fim precisa ser depois de hoje.");
  const days = countCampaignDays(today, input.endDate);
  if (isBelowMinDailyBudget({ budgetBrlCents: input.budgetBrlCents, days, minDailyBudgetCents: meta.account.minDailyBudgetCents })) {
    throw new CampaignBuilderError(
      "BAD_REQUEST",
      `A verba dá menos que o mínimo diário da conta (${formatBrlFromCents(meta.account.minDailyBudgetCents ?? 0)} por dia). Aumente a verba ou encurte o prazo.`,
    );
  }

  const usage = await getOrderBudgetUsage(meta, order);
  const estimate = estimateBudgetComplement({
    budgetBrlCents: input.budgetBrlCents,
    declaredBudgetBrlCents: order.adBudgetBrlCents,
    spentBrlCents: usage.spentBrlCents,
  });
  if (estimate.needsConfirmation && !input.isComplementConfirmed) {
    throw new CampaignBuilderError(
      "BAD_REQUEST",
      `A verba passa do saldo declarado em ${formatBrlFromCents(estimate.excessBrlCents)}: confirme o complemento estimado de ${formatBrlFromCents(estimate.estimatedComplementBrlCents)}.`,
    );
  }

  const { source, text } = await resolveAdSource(meta, order, page, input.source);
  assertAdTextAllowed(text, input.isPolicyWarningConfirmed);

  const campaignName = buildCampaignName({ orderCode: order.code, businessName: order.businessName, draftKey: input.draftKey });
  let campaignId: string | null = null;
  try {
    campaignId = (
      await createMetaObject(meta.auth, meta.auth.adAccountId, "campaigns", buildCampaignPayload({
        name: campaignName,
        lifetimeBudgetCents: input.budgetBrlCents,
      }))
    ).id;
    const adset = await createMetaObject(meta.auth, meta.auth.adAccountId, "adsets", buildAdSetPayload({
      name: `${order.code} — Público`,
      campaignId,
      pageId: page.id,
      audience: input.audience,
      endTimeIso: buildEndTimeIso(input.endDate, meta.account.timezoneName),
    }));
    const creative = await createMetaObject(meta.auth, meta.auth.adAccountId, "adcreatives", buildCreativePayload({
      name: `${order.code} — Criativo`,
      pageId: page.id,
      instagramUserId: page.instagramUserId,
      source,
    }));
    await createMetaObject(meta.auth, meta.auth.adAccountId, "ads", buildAdPayload({
      name: `${order.code} — Anúncio`,
      adsetId: adset.id,
      creativeId: creative.id,
    }));
  } catch (error) {
    if (campaignId) {
      await updateMetaObject(meta.auth, campaignId, { status: "ARCHIVED" }).catch((archiveError: unknown) => {
        console.error("[trafego/campaign-builder] rascunho incompleto não arquivado:", archiveError);
      });
    }
    throw new CampaignBuilderError("BAD_REQUEST", `A Meta recusou o rascunho: ${toUserMessage(error)}`);
  }

  const campaign = await getMetaCampaignTree(meta.auth, campaignId);
  await mirrorCampaign(meta, order, campaign, actor.id);
  await recordBuilderEffects({
    order,
    actor,
    title: "Rascunho de campanha criado",
    detail: `${campaignName} · verba ${formatBrlFromCents(input.budgetBrlCents)} até ${input.endDate.split("-").reverse().join("/")} · pausado`,
    action: "trafego.campaign_draft_created",
    metadata: { campaignId, budgetBrlCents: input.budgetBrlCents, sourceKind: input.source.kind },
  });
  return { campaign, isExisting: false };
}

const PUBLISHABLE_FROM_STATUSES = ["ONBOARDING", "MATERIALS_SUBMITTED", "REQUESTED", "CHANGES_REQUESTED", "SCHEDULED"] as const;

/** Ativa anúncio, conjunto e campanha, nessa ordem, e relê (RF-9, CA-7). */
export async function publishCampaign(meta: AccountMeta, order: BuilderOrder, campaignId: string, actor: BuilderActor) {
  const campaign = await requireOrderCampaign(meta, order, campaignId);
  const liveAds = campaign.ads.filter((ad) => ad.status !== "ARCHIVED" && ad.status !== "DELETED");
  if (liveAds.length === 0) throw new CampaignBuilderError("BAD_REQUEST", "A campanha não tem anúncio para publicar.");

  try {
    for (const ad of liveAds) await updateMetaObject(meta.auth, ad.id, { status: "ACTIVE" });
    for (const adset of campaign.adsets.filter((item) => item.status !== "ARCHIVED" && item.status !== "DELETED")) {
      await updateMetaObject(meta.auth, adset.id, { status: "ACTIVE" });
    }
    await updateMetaObject(meta.auth, campaign.id, { status: "ACTIVE" });
  } catch (error) {
    throw new CampaignBuilderError("BAD_REQUEST", `A Meta não publicou: ${toUserMessage(error)}`);
  }

  const published = await getMetaCampaignTree(meta.auth, campaign.id);
  await mirrorCampaign(meta, order, published, actor.id);

  // Pedido pausado pela equipe continua pausado: retomar o pedido é decisão dela (CB-9).
  if ((PUBLISHABLE_FROM_STATUSES as readonly string[]).includes(order.status)) {
    await transitionTrafegoOrder({
      orderId: order.id,
      toStatus: "RUNNING",
      source: "CLIENT",
      actorUserId: actor.id,
      organizationId: order.organizationId,
      expectedFrom: [...PUBLISHABLE_FROM_STATUSES],
      title: "Campanha no ar",
      clientNote: `${published.name} foi publicada pelo painel.`,
    }).catch((error: unknown) => console.error("[trafego/campaign-builder] pedido não foi a RUNNING:", error));
  }
  await recordBuilderEffects({
    order,
    actor,
    title: "Campanha publicada",
    detail: published.name,
    action: "trafego.campaign_published",
    metadata: { campaignId: campaign.id },
  });
  await notifyTrafegoAdmins({
    title: `trafeGO ${order.code}: campanha publicada pelo cliente`,
    body: `${published.name} foi ao ar pelo painel (${actor.name || actor.email}).`,
    actionUrl: `/admin/trafego/${order.id}`,
  }).catch((error: unknown) => console.error("[trafego/campaign-builder] aviso à equipe falhou:", error));
  return { campaign: published };
}
