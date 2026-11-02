import "server-only";

import { fetchAdsInsightsDetailed, type InsightRow, type MetaInsightsFilter } from "@/http/meta/ads-management";
import { metaGraphRequest } from "@/http/meta/graph-client";
import { toCents } from "@/features/trafego/lib/order-meta-metrics";
import { averageAdMetrics, type AdMetricsInput } from "@/features/trafego/lib/order-ads-metrics";
import { buildMetaReadCacheKey, readThroughMetaCache } from "./meta-read-cache";
import { resolveOrderMetaAccess, toOrderMetaUnavailable } from "./order-meta-access";

/**
 * Resumo da conta de anúncios da org para orientar o passo a passo (spec 0129, RF-3, D-3).
 * Só a integração da org de quem pede; a IA recebe este texto pronto e nunca chama a Meta.
 */

const CONTEXT_DAYS = 90;
const TOP_ADS = 5;
const MIN_CONVERSATIONS_FOR_TOP = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const ALL_STATUSES_FILTER: MetaInsightsFilter = {
  field: "campaign.effective_status",
  operator: "IN",
  value: ["ACTIVE", "PAUSED", "ARCHIVED", "DELETED", "IN_PROCESS", "WITH_ISSUES"],
};

export interface WizardAccountSummary {
  status: "ok" | "no_history" | "unavailable" | "not_connected";
  message: string | null;
  avgCostPerConversationCents: number | null;
  minDailyBudgetCents: number | null;
  adsAnalyzed: number;
  isSample: boolean;
}

export interface WizardAccountContext {
  summary: WizardAccountSummary;
  /** Texto para o modelo; null quando não há histórico para contar. */
  promptText: string | null;
}

type AdCreativeTexts = { data?: { id: string; creative?: { body?: string; title?: string; object_type?: string; video_id?: string } }[] };
type DisapprovedAds = { data?: { name?: string }[] };

function toDateOnly(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toInput(row: InsightRow): AdMetricsInput {
  return {
    spendCents: toCents(row.spend),
    impressions: row.impressions,
    reach: row.reach,
    clicks: row.clicks,
    conversations: row.messagingConversations,
  };
}

function costPerConversation(row: InsightRow): number {
  return row.messagingConversations > 0 ? toCents(row.spend) / row.messagingConversations : Number.POSITIVE_INFINITY;
}

function describeSegments(rows: InsightRow[]): string[] {
  return rows
    .filter((row) => row.messagingConversations >= MIN_CONVERSATIONS_FOR_TOP && row.age && row.gender)
    .sort((first, second) => costPerConversation(first) - costPerConversation(second))
    .slice(0, 4)
    .map(
      (row) =>
        `${row.age} anos, ${row.gender === "female" ? "mulheres" : row.gender === "male" ? "homens" : "gênero não informado"}: ` +
        `${row.messagingConversations} conversas a ${formatBrl(Math.round(costPerConversation(row)))} cada`,
    );
}

export async function loadWizardAccountContext(organizationId: string): Promise<WizardAccountContext> {
  const access = await resolveOrderMetaAccess({ organizationId });
  if (access.mode === "legacy") {
    return {
      summary: { status: "not_connected", message: null, avgCostPerConversationCents: null, minDailyBudgetCents: null, adsAnalyzed: 0, isSample: false },
      promptText: null,
    };
  }
  if (access.mode === "unavailable") {
    return {
      summary: {
        status: "unavailable",
        message: "Não consegui ler sua conta da Meta agora.",
        avgCostPerConversationCents: null,
        minDailyBudgetCents: null,
        adsAnalyzed: 0,
        isSample: false,
      },
      promptText: null,
    };
  }

  const now = Date.now();
  const period = { since: toDateOnly(now - CONTEXT_DAYS * DAY_MS), until: toDateOnly(now) };
  const minDailyBudgetCents = access.account.minDailyBudgetCents;

  return readThroughMetaCache(
    buildMetaReadCacheKey({ block: "wizard-account-context", org: organizationId, act: access.auth.adAccountId, since: period.since }),
    async () => {
      const [adsResult, segmentsResult, disapproved] = await Promise.all([
        fetchAdsInsightsDetailed(access.auth, {
          level: "ad",
          timeRange: period,
          unifiedAttribution: true,
          filtering: [ALL_STATUSES_FILTER],
          maxPages: 5,
          extraFields: ["objective"],
        }),
        fetchAdsInsightsDetailed(access.auth, {
          level: "account",
          timeRange: period,
          unifiedAttribution: true,
          breakdowns: ["age", "gender"],
          maxPages: 2,
        }).catch(() => ({ rows: [] as InsightRow[], truncated: false })),
        metaGraphRequest<DisapprovedAds>(`${access.auth.adAccountId}/ads`, {
          auth: access.auth,
          query: { fields: "name", effective_status: JSON.stringify(["DISAPPROVED"]), limit: 5 },
        }).catch(() => ({ data: [] }) as DisapprovedAds),
      ]);

      const delivered = adsResult.rows.filter((row) => row.adId && toCents(row.spend) > 0);
      const average = averageAdMetrics(delivered.map(toInput));
      const hasConversations = Boolean(average && average.conversations > 0);
      const avgCostPerConversationCents = hasConversations && average ? average.costPerConversationCents : null;

      const summary: WizardAccountSummary = {
        status: delivered.length > 0 ? "ok" : "no_history",
        message: delivered.length > 0 ? null : "Sua conta ainda não tem histórico de anúncios.",
        avgCostPerConversationCents,
        minDailyBudgetCents,
        adsAnalyzed: delivered.length,
        isSample: adsResult.truncated,
      };
      if (delivered.length === 0) return { summary, promptText: null };

      const topAds = delivered
        .filter((row) => row.messagingConversations >= MIN_CONVERSATIONS_FOR_TOP)
        .sort((first, second) => costPerConversation(first) - costPerConversation(second))
        .slice(0, TOP_ADS);
      // Filtro por id na lista de anúncios: o parâmetro `ids` foi descontinuado pela Meta.
      const creativesResult = topAds.length
        ? await metaGraphRequest<AdCreativeTexts>(`${access.auth.adAccountId}/ads`, {
            auth: access.auth,
            query: {
              fields: "id,creative{body,title,object_type,video_id}",
              filtering: JSON.stringify([{ field: "id", operator: "IN", value: topAds.map((row) => row.adId) }]),
              limit: TOP_ADS,
            },
          }).catch(() => ({ data: [] }) as AdCreativeTexts)
        : ({ data: [] } as AdCreativeTexts);
      const creativeByAdId = new Map((creativesResult.data ?? []).map((ad) => [ad.id, ad.creative]));
      const disapprovedNames = [...new Set((disapproved.data ?? []).map((ad) => ad.name ?? "Anúncio"))];

      const objectives = new Map<string, InsightRow[]>();
      for (const row of delivered) {
        if (!row.objective) continue;
        objectives.set(row.objective, [...(objectives.get(row.objective) ?? []), row]);
      }

      const lines = [
        `Conta de anúncios, últimos ${CONTEXT_DAYS} dias${adsResult.truncated ? " (amostra)" : ""}: ${delivered.length} anúncios com gasto.`,
        average &&
          `Média por anúncio: ${average.conversations} conversas, CTR ${average.ctr}%, CPC ${formatBrl(average.cpcCents)}, ` +
            `CPM ${formatBrl(average.cpmCents)}` +
            (avgCostPerConversationCents ? `, custo por conversa ${formatBrl(avgCostPerConversationCents)}.` : "."),
        objectives.size > 0 && "Objetivos usados:",
        ...[...objectives].map(([objective, rows]) => {
          const objectiveAverage = averageAdMetrics(rows.map(toInput));
          return `- ${objective}: ${rows.length} anúncios` +
            (objectiveAverage && objectiveAverage.conversations > 0
              ? `, custo por conversa ${formatBrl(objectiveAverage.costPerConversationCents)}`
              : ", sem conversas");
        }),
        topAds.length > 0 && "Anúncios com menor custo por conversa:",
        ...topAds.map((row) => {
          const creative = creativeByAdId.get(row.adId as string);
          const isVideo = creative?.object_type === "VIDEO" || Boolean(creative?.video_id);
          return `- "${row.adName ?? "Anúncio"}" (${isVideo ? "vídeo" : "imagem"}): ` +
            `${row.messagingConversations} conversas a ${formatBrl(Math.round(costPerConversation(row)))}. ` +
            `Texto: "${(creative?.body ?? "").slice(0, 300)}"` +
            (creative?.title ? ` Título: "${creative.title.slice(0, 80)}"` : "");
        }),
        segmentsResult.rows.length > 0 && "Idade e gênero com menor custo por conversa:",
        ...describeSegments(segmentsResult.rows).map((line) => `- ${line}`),
        disapprovedNames.length > 0 &&
          `Anúncios reprovados recentemente (evite o mesmo tema ou abordagem): ${disapprovedNames.map((name) => `"${name}"`).join(", ")}.`,
      ].filter((line): line is string => typeof line === "string" && line.length > 0);

      return { summary, promptText: lines.join("\n") };
    },
  ).catch((error: unknown) => {
    const unavailable = toOrderMetaUnavailable(error);
    return {
      summary: {
        status: "unavailable" as const,
        message: unavailable.message,
        avgCostPerConversationCents: null,
        minDailyBudgetCents,
        adsAnalyzed: 0,
        isSample: false,
      },
      promptText: null,
    };
  });
}
