"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronDown, Layers } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { useTrafegoAccountCampaignAds } from "@/features/trafego/hooks/use-trafego-account";
import { usePanelPath } from "@/features/trafego/lib/base-path";
import type { AdMetrics } from "@/features/trafego/lib/order-ads-metrics";
import { META_CAMPAIGN_OBJECTIVE_LABEL, type AccountPeriodSelection } from "@/features/trafego/lib/order-meta-metrics";
import { AD_METRICS, formatMetric, type MetricDefinition } from "../campaign-overview/ad-metrics";
import { AdsList } from "../campaign-overview/ads-list";
import { CAMPAIGN_STATUS_LABEL, formatMoneyFromCents } from "../account-performance-sections";

/** Uma campanha da conta: números no fechado; conjuntos e anúncios ao abrir (lidos só nessa hora). */

export interface AccountCampaignRowData {
  id: string;
  name: string;
  objective: string | null;
  status: string | null;
  dailyBudgetCents: number | null;
  lifetimeBudgetCents: number | null;
  metrics: AdMetrics;
  order: { id: string; code: string } | null;
}

const ROW_METRIC_KEYS: (keyof AdMetrics)[] = [
  "spendCents",
  "conversations",
  "costPerConversationCents",
  "ctr",
  "cpcCents",
  "impressions",
];
const ROW_METRICS = ROW_METRIC_KEYS.map(
  (key) => AD_METRICS.find((definition) => definition.key === key) as MetricDefinition,
);
const ADSET_METRICS = ROW_METRICS.slice(0, 4);

const ADSET_STATUS_LABEL: Record<string, string> = {
  ...CAMPAIGN_STATUS_LABEL,
  ADSET_PAUSED: "Pausado",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  CAMPAIGN_PAUSED: "Pausado pela campanha",
};

export function DeliveryChip({ status, labels = CAMPAIGN_STATUS_LABEL }: { status: string | null; labels?: Record<string, string> }) {
  const isLive = status === "ACTIVE";
  const isProblem = status === "WITH_ISSUES" || status === "DISAPPROVED";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px]",
        isLive && "bg-success/15 text-success",
        isProblem && "bg-destructive/15 text-destructive",
        !isLive && !isProblem && "bg-muted text-muted-foreground",
      )}
    >
      {status ? (labels[status] ?? status) : "Arquivada"}
    </span>
  );
}

function describeBudget(campaign: AccountCampaignRowData, currency: string): string | null {
  if (campaign.dailyBudgetCents) return `${formatMoneyFromCents(campaign.dailyBudgetCents, currency)}/dia`;
  if (campaign.lifetimeBudgetCents) return `${formatMoneyFromCents(campaign.lifetimeBudgetCents, currency)} no total`;
  return null;
}

function MetricCells({
  metrics,
  definitions,
  currency,
  className,
}: {
  metrics: AdMetrics;
  definitions: MetricDefinition[];
  currency: string;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-3 gap-y-2", className)}>
      {definitions.map((definition) => (
        <div key={definition.key} className="min-w-0">
          <dt className="truncate text-[11px] text-muted-foreground">{definition.label}</dt>
          <dd className="truncate text-sm font-semibold tabular-nums">{formatMetric(metrics, definition, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AccountCampaignRow({
  campaign,
  currency,
  period,
}: {
  campaign: AccountCampaignRowData;
  currency: string;
  period: AccountPeriodSelection;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelPath = usePanelPath();
  const budget = describeBudget(campaign, currency);
  const objectiveLabel = campaign.objective
    ? (META_CAMPAIGN_OBJECTIVE_LABEL[campaign.objective] ?? campaign.objective)
    : null;

  return (
    <div className="overflow-hidden rounded-[20px] border bg-card">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-muted/40 lg:flex-row lg:items-center"
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <ChevronDown
            className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition", isOpen && "rotate-180")}
          />
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium">{campaign.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <DeliveryChip status={campaign.status} />
              {objectiveLabel && <span>{objectiveLabel}</span>}
              {budget && <span>· {budget}</span>}
              {campaign.order && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  trafeGO · {campaign.order.code}
                </span>
              )}
            </div>
          </div>
        </div>
        <MetricCells
          metrics={campaign.metrics}
          definitions={ROW_METRICS}
          currency={currency}
          className="grid-cols-3 pl-6 sm:grid-cols-6 lg:w-[560px] lg:shrink-0 lg:pl-0"
        />
      </button>

      {isOpen && (
        <div className="border-t bg-muted/20 p-3 md:p-4">
          {campaign.order && (
            <Link
              href={`${panelPath}/${campaign.order.id}`}
              className="mb-3 inline-flex text-xs text-primary hover:underline"
            >
              Abrir o pedido {campaign.order.code} no trafeGO
            </Link>
          )}
          <CampaignDetail campaignId={campaign.id} period={period} currency={currency} />
        </div>
      )}
    </div>
  );
}

function CampaignDetail({
  campaignId,
  period,
  currency,
}: {
  campaignId: string;
  period: AccountPeriodSelection;
  currency: string;
}) {
  const { data, isLoading } = useTrafegoAccountCampaignAds(campaignId, period);

  if (isLoading || !data) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <OrbitaSpinner className="size-4" /> Lendo conjuntos e anúncios…
      </p>
    );
  }
  if (data.mode !== "account") {
    return (
      <p className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        {"message" in data ? data.message : "Não foi possível ler esta campanha agora."}
      </p>
    );
  }
  if (data.adsets.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">Esta campanha ainda não tem conjuntos de anúncios.</p>;
  }

  const adsets = [...data.adsets].sort((first, second) => second.metrics.spendCents - first.metrics.spendCents);

  return (
    <div className="space-y-4">
      {adsets.map((adset) => {
        const ads = data.ads.filter((ad) => ad.adsetId === adset.id);
        return (
          <section key={adset.id} className="space-y-2">
            <div className="flex flex-col gap-2 rounded-[16px] border bg-card px-3 py-2.5 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Conjunto de anúncios</p>
                  <p className="truncate text-sm font-medium">{adset.name}</p>
                  <div className="mt-0.5">
                    <DeliveryChip status={adset.effectiveStatus ?? adset.status} labels={ADSET_STATUS_LABEL} />
                  </div>
                </div>
              </div>
              <MetricCells
                metrics={adset.metrics}
                definitions={ADSET_METRICS}
                currency={currency}
                className="grid-cols-4 pl-6 md:w-[380px] md:shrink-0 md:pl-0"
              />
            </div>
            {ads.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground">Nenhum anúncio neste conjunto.</p>
            ) : (
              <AdsList
                orderId={null}
                ads={ads}
                currency={currency}
                canFix={false}
                isQualityScoreVisible={data.isQualityScoreVisible}
              />
            )}
          </section>
        );
      })}
      {data.averages && (
        <p className="text-[11px] text-muted-foreground">
          Setas: acima ou abaixo da média dos anúncios do mesmo objetivo na sua conta. Verde é bom, vermelho pede atenção.
        </p>
      )}
      {data.isTruncated && <p className="text-xs text-muted-foreground">Mostrando os primeiros anúncios da campanha.</p>}
    </div>
  );
}
