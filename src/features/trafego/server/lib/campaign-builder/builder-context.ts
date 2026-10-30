import "server-only";

import prisma from "@/lib/prisma";
import { getPublicMediaUrl } from "@/lib/r2-url";
import { actId } from "@/http/meta/ads-management";
import { getPageWhatsappNumber, listPromotablePages } from "@/http/meta/ads-account";
import {
  findMetaCampaignTreesByName,
  getMetaCampaignTree,
  listAdSetPerformanceForSuggestion,
  listInstagramMedia,
  searchMetaCities,
  type MetaCampaignTree,
} from "@/http/meta/ads-builder";
import { MetaGraphError } from "@/http/meta/graph-client";
import { formatDateInTimeZone, isOrderCampaign } from "@/features/trafego/lib/order-meta-metrics";
import { readAudienceFromTargeting } from "@/features/trafego/lib/campaign-builder/build-meta-payloads";
import { pickSuggestionAdSet } from "@/features/trafego/lib/campaign-builder/builder-rules";
import { buildMetaReadCacheKey, readThroughMetaCache } from "../meta/meta-read-cache";
import { getOrderBudgetUsage } from "../meta/order-meta-performance";
import type { BuilderOrder } from "./builder-access";
import type { OrderMetaAccess } from "../meta/order-meta-access";

/** Leituras do construtor de campanha (spec 0124, RF-3..RF-5, RF-10). Nada aqui escreve na Meta. */

export type AccountMeta = Extract<OrderMetaAccess, { mode: "account" }>;

const DAY_MS = 24 * 60 * 60 * 1000;

export class CampaignBuilderError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "BAD_REQUEST",
    message: string,
  ) {
    super(message);
  }
}

function cacheKey(meta: AccountMeta, parts: Record<string, string | number | null | undefined>) {
  return buildMetaReadCacheKey({ ...parts, org: meta.organizationId, act: meta.auth.adAccountId });
}

export interface BuilderPage {
  id: string;
  name: string;
  instagramUserId: string | null;
  instagramUsername: string | null;
  whatsappNumber: string | null;
}

/** Páginas da conta com o WhatsApp ligado de cada uma (CB-1). */
export async function listBuilderPages(meta: AccountMeta): Promise<BuilderPage[]> {
  return readThroughMetaCache(cacheKey(meta, { block: "builder-pages" }), async () => {
    const pages = await listPromotablePages(meta.auth, meta.auth.adAccountId);
    return Promise.all(
      pages.slice(0, 5).map(async (page) => ({ ...page, whatsappNumber: await getPageWhatsappNumber(meta.auth, page.id) })),
    );
  });
}

export async function requireBuilderPage(meta: AccountMeta, pageId: string): Promise<BuilderPage> {
  const page = (await listBuilderPages(meta)).find((candidate) => candidate.id === pageId);
  if (!page) throw new CampaignBuilderError("BAD_REQUEST", "Esta página não anuncia por esta conta de anúncios.");
  if (!page.whatsappNumber) {
    throw new CampaignBuilderError(
      "BAD_REQUEST",
      "A página não tem WhatsApp ligado. Ligue em Configurações da página → WhatsApp e teste a conexão de novo.",
    );
  }
  return page;
}

/** Campanhas "deste pedido" na conta: o código no nome ou a campanha vinculada (RNF-3, CA-10). */
export async function listOrderCampaigns(meta: AccountMeta, order: BuilderOrder): Promise<MetaCampaignTree[]> {
  const byName = await findMetaCampaignTreesByName(meta.auth, meta.auth.adAccountId, order.code);
  const campaigns = byName.filter((campaign) =>
    isOrderCampaign({
      campaignId: campaign.id,
      campaignName: campaign.name,
      orderCode: order.code,
      linkedCampaignId: order.metaCampaignExternalId,
    }),
  );
  if (order.metaCampaignExternalId && !campaigns.some((campaign) => campaign.id === order.metaCampaignExternalId)) {
    const linked = await getMetaCampaignTree(meta.auth, order.metaCampaignExternalId).catch(() => null);
    if (linked && isSameAccount(meta, linked)) campaigns.push(linked);
  }
  return campaigns;
}

function isSameAccount(meta: AccountMeta, campaign: MetaCampaignTree): boolean {
  return !campaign.accountId || actId(campaign.accountId) === meta.auth.adAccountId;
}

/** A campanha precisa ser da conta da org E do pedido; qualquer outra coisa é NOT_FOUND (CA-10). */
export async function requireOrderCampaign(
  meta: AccountMeta,
  order: BuilderOrder,
  campaignId: string,
): Promise<MetaCampaignTree> {
  const campaign = await getMetaCampaignTree(meta.auth, campaignId).catch((error: unknown) => {
    if (error instanceof MetaGraphError && error.kind !== "rate_limited" && error.kind !== "transient") return null;
    throw error;
  });
  const isFromOrder =
    campaign &&
    isSameAccount(meta, campaign) &&
    isOrderCampaign({
      campaignId: campaign.id,
      campaignName: campaign.name,
      orderCode: order.code,
      linkedCampaignId: order.metaCampaignExternalId,
    });
  if (!campaign || !isFromOrder) throw new CampaignBuilderError("NOT_FOUND", "Campanha não encontrada neste pedido.");
  return campaign;
}

export async function getBuilderContext(meta: AccountMeta, order: BuilderOrder) {
  const [pages, budget, campaigns, creatives, copies] = await Promise.all([
    listBuilderPages(meta),
    getOrderBudgetUsage(meta, order),
    listOrderCampaigns(meta, order),
    prisma.trafegoCreative.findMany({
      where: { orderId: order.id, kind: "IMAGE", status: { not: "REJECTED" } },
      orderBy: { position: "asc" },
      take: 20,
      select: { id: true, fileKey: true, fileName: true },
    }),
    prisma.trafegoCopy.findMany({
      where: { orderId: order.id },
      orderBy: [{ isSelected: "desc" }, { position: "asc" }],
      take: 20,
      select: { id: true, headline: true, primaryText: true, isSelected: true },
    }),
  ]);

  return {
    account: {
      name: meta.account.name,
      currency: meta.account.currency,
      timezoneName: meta.account.timezoneName,
      accountStatus: meta.account.accountStatus,
      minDailyBudgetCents: meta.account.minDailyBudgetCents,
    },
    today: formatDateInTimeZone(new Date(), meta.account.timezoneName),
    pages,
    budget,
    campaigns,
    images: await Promise.all(
      creatives.map(async (creative) => ({
        id: creative.id,
        fileName: creative.fileName,
        url: await getPublicMediaUrl(creative.fileKey),
      })),
    ),
    copies,
  };
}

/** Sugestão de público pelo melhor conjunto antigo (menor custo por conversa em 180 dias). */
export async function suggestBuilderAudience(meta: AccountMeta) {
  return readThroughMetaCache(cacheKey(meta, { block: "audience-suggestion" }), async () => {
    const now = new Date();
    const period = {
      since: formatDateInTimeZone(new Date(now.getTime() - 180 * DAY_MS), meta.account.timezoneName),
      until: formatDateInTimeZone(now, meta.account.timezoneName),
    };
    const adsets = await listAdSetPerformanceForSuggestion(meta.auth, meta.auth.adAccountId, period);
    const best = pickSuggestionAdSet(adsets.filter((adset) => readAudienceFromTargeting(adset.targeting)));
    const audience = best ? readAudienceFromTargeting(best.targeting) : null;
    if (!best || !audience) return { source: "none" as const, audience: null };
    return {
      source: "history" as const,
      audience,
      costPerConversationCents: Math.round(best.spendCents / best.conversations),
      conversations: best.conversations,
    };
  });
}

export async function searchBuilderCities(meta: AccountMeta, query: string) {
  return readThroughMetaCache(cacheKey(meta, { block: "cities", query: query.toLowerCase() }), () =>
    searchMetaCities(meta.auth, query),
  );
}

/** Posts elegíveis do Instagram da página (RF-5). Sem tarefa de conteúdo na página, a Meta nega (CB-3). */
export async function listBuilderInstagramPosts(meta: AccountMeta, page: BuilderPage) {
  if (!page.instagramUserId) {
    return { status: "no_instagram" as const, message: "A página não tem Instagram ligado a esta conta.", posts: [], excludedCount: 0 };
  }
  try {
    const media = await readThroughMetaCache(cacheKey(meta, { block: "ig-media", ig: page.instagramUserId }), () =>
      listInstagramMedia(meta.auth, page.instagramUserId as string),
    );
    const posts = media.items.filter(
      (item) => item.mediaProductType !== "STORY" && item.isBoostEligible,
    );
    return {
      status: "ok" as const,
      message: null,
      posts,
      excludedCount: media.items.length - posts.length,
      excludedReasons: [...new Set(media.items.filter((item) => !item.isBoostEligible).map((item) => item.ineligibleReason).filter(Boolean))],
    };
  } catch (error) {
    if (error instanceof MetaGraphError && error.kind === "permission") {
      return {
        status: "no_permission" as const,
        message:
          "A conexão não consegue ler os posts. No Business, atribua a página ao usuário do sistema com a tarefa de conteúdo. Enquanto isso, use uma imagem.",
        posts: [],
        excludedCount: 0,
      };
    }
    throw error;
  }
}
