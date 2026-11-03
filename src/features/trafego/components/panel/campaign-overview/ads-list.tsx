"use client";

import { ExternalLink, ImageOff } from "lucide-react";
import type { AdMetrics } from "@/features/trafego/lib/order-ads-metrics";
import { AD_METRICS, formatMetric } from "./ad-metrics";
import type { QualityResult } from "@/features/trafego/lib/quality-score";
import { QualityScoreBadge } from "../quality/quality-score-badge";
import { IndicatorPopover } from "../quality/indicator-popover";
import { AdOriginLine } from "../quality/ad-origin-line";

/** Um cartão por anúncio no celular e uma tabela no computador (spec 0126, RF-2, RNF-1). */

export interface AdRow {
  id: string;
  name: string;
  status: string | null;
  previewUrl: string | null;
  previewLink: string | null;
  metrics: AdMetrics;
  benchmark: AdMetrics | null;
  benchmarkScope: "objective" | "account";
  quality: QualityResult;
  evaluateFrom: string | null;
  initialMessage: string | null;
  leadOrigin: { leadsCount: number; trackings: { name: string; count: number }[]; tags: { name: string; count: number }[] } | null;
}

const AD_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "No ar",
  PAUSED: "Pausado",
  ADSET_PAUSED: "Pausado",
  CAMPAIGN_PAUSED: "Pausado",
  IN_PROCESS: "Em análise",
  PENDING_REVIEW: "Em análise",
  DISAPPROVED: "Reprovado",
  WITH_ISSUES: "Com problema",
  ARCHIVED: "Arquivado",
  DELETED: "Excluído",
};

const CARD_METRICS = AD_METRICS.filter((definition) =>
  ["spendCents", "conversations", "ctr", "cpcCents", "cpmCents", "costPerConversationCents"].includes(definition.key),
);

function AdPreview({ ad, className }: { ad: AdRow; className: string }) {
  if (!ad.previewUrl) {
    return (
      <div className={`${className} grid place-items-center bg-muted text-muted-foreground`}>
        <ImageOff className="size-5" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- prévia vem do CDN da Meta, sem domínio fixo
  return <img src={ad.previewUrl} alt={`Prévia do anúncio ${ad.name}`} className={`${className} object-cover`} />;
}

function StatusChip({ status }: { status: string | null }) {
  const label = status ? (AD_STATUS_LABEL[status] ?? status) : "—";
  const isLive = status === "ACTIVE";
  const isProblem = status === "DISAPPROVED" || status === "WITH_ISSUES";
  return (
    <span
      className={
        isLive
          ? "rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success"
          : isProblem
            ? "rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive"
            : "rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
      }
    >
      {label}
    </span>
  );
}

function PreviewLink({ ad }: { ad: AdRow }) {
  if (!ad.previewLink) return null;
  return (
    <a
      href={ad.previewLink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      Ver anúncio <ExternalLink className="size-3" />
    </a>
  );
}

export function AdsList({
  orderId,
  ads,
  currency,
  canFix,
  isQualityScoreVisible,
}: {
  orderId: string;
  ads: AdRow[];
  currency: string;
  canFix: boolean;
  isQualityScoreVisible: boolean;
}) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {ads.map((ad) => (
          <div key={ad.id} className="rounded-[20px] border bg-card p-3">
            <div className="flex gap-3">
              <AdPreview ad={ad} className="size-20 shrink-0 rounded-[14px]" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{ad.name}</p>
                {isQualityScoreVisible && <QualityScoreBadge quality={ad.quality} className="mt-1" />}
                <AdOriginLine initialMessage={ad.initialMessage} leadOrigin={ad.leadOrigin} conversations={ad.metrics.conversations} />
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusChip status={ad.status} />
                  <PreviewLink ad={ad} />
                </div>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2">
              {CARD_METRICS.map((definition) => (
                <div key={definition.key} className="min-w-0">
                  <dt className="truncate text-[11px] text-muted-foreground">{definition.label}</dt>
                  <dd className="flex items-baseline gap-1 truncate text-sm font-semibold tabular-nums">
                    {formatMetric(ad.metrics, definition, currency)}
                    <IndicatorPopover orderId={orderId} ad={ad} metric={definition.key} canFix={canFix} isEnabled={isQualityScoreVisible} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[20px] border max-md:hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Anúncio</th>
              {AD_METRICS.map((definition) => (
                <th key={definition.key} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {definition.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => (
              <tr key={ad.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <AdPreview ad={ad} className="size-12 shrink-0 rounded-[12px]" />
                    <div className="min-w-0">
                      <p className="flex max-w-80 items-center gap-2 font-medium">
                        <span className="truncate">{ad.name}</span>
                        {isQualityScoreVisible && <QualityScoreBadge quality={ad.quality} />}
                      </p>
                      <AdOriginLine
                        initialMessage={ad.initialMessage}
                        leadOrigin={ad.leadOrigin}
                        conversations={ad.metrics.conversations}
                      />
                      <div className="mt-0.5 flex items-center gap-2">
                        <StatusChip status={ad.status} />
                        <PreviewLink ad={ad} />
                      </div>
                    </div>
                  </div>
                </td>
                {AD_METRICS.map((definition) => (
                  <td key={definition.key} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    <span className="inline-flex items-baseline gap-1">
                      <IndicatorPopover orderId={orderId} ad={ad} metric={definition.key} canFix={canFix} isEnabled={isQualityScoreVisible} />
                      {formatMetric(ad.metrics, definition, currency)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
