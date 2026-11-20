"use client";

import { useState } from "react";
import { AlertTriangle, Radio } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useTrafegoAccountOverview, useTrafegoOrderBudget } from "@/features/trafego/hooks/use-trafego-performance";
import type { AccountKpiFormat, PerformanceRange } from "@/features/trafego/lib/order-meta-metrics";
import { TechnicalTerm, type TechnicalTermKey } from "../technical-term";
import {
  AccountBreakdownSection,
  AccountCampaignList,
  DailySpendChart,
  formatMoneyFromCents,
} from "./account-performance-sections";
import { ServiceFeeSection } from "./service-fee-section";

/** Desempenho com os números da conta de anúncios do cliente, como no Gerenciador (spec 0122, RF-12). */

const RANGE_OPTIONS: { key: PerformanceRange; label: string }[] = [
  { key: "order", label: "Período do pedido" },
  { key: "last_7d", label: "7 dias" },
  { key: "last_30d", label: "30 dias" },
];

export const KPI_TERMS: Record<string, TechnicalTermKey> = {
  conversations: "conversation",
  costPerConversation: "costPerConversation",
  reach: "reach",
  impressions: "impression",
  clicks: "click",
  ctr: "ctr",
  cpm: "cpm",
  frequency: "frequency",
};

export function formatKpi(value: number, format: AccountKpiFormat, currency: string): string {
  if (format === "currency") return formatMoneyFromCents(value, currency);
  if (format === "pct") return `${value.toFixed(2).replace(".", ",")}%`;
  if (format === "decimal") return value.toFixed(2).replace(".", ",");
  return Math.round(value).toLocaleString("pt-BR");
}

export function AccountPerformanceView({ orderId, orderCode }: { orderId: string; orderCode: string }) {
  const [range, setRange] = useState<PerformanceRange>("order");
  const { data: overview, isLoading } = useTrafegoAccountOverview(orderId, range);
  const { data: budgetResult } = useTrafegoOrderBudget(orderId);

  if (isLoading || !overview) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <OrbitaSpinner className="size-4" />
        Lendo a conta de anúncios…
      </div>
    );
  }

  if (overview.mode === "unavailable") {
    return (
      <div className="flex items-start gap-2 rounded-[20px] border border-warning/40 bg-warning/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>{overview.message}</p>
      </div>
    );
  }
  if (overview.mode !== "account") return null;

  const currency = overview.account.currency;
  const budget = budgetResult?.mode === "account" ? budgetResult.budget : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Radio className="size-3.5 text-success" />
          {overview.account.name} · {currency} · atualizado às{" "}
          {new Date(overview.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              className={cn(
                "min-h-8 rounded-full px-3 text-xs transition",
                range === option.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {overview.account.accountStatus !== 1 && (
        <p className="flex items-center gap-1.5 rounded-[16px] border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          <AlertTriangle className="size-3.5 text-warning" />
          Conta de anúncios: {overview.account.statusLabel}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {overview.kpis.map((kpi) => (
          <div key={kpi.key} className="min-w-0 rounded-[18px] border bg-card px-3.5 py-3">
            <p className="text-[12px] text-muted-foreground">
              {kpi.label}
              {KPI_TERMS[kpi.key] && <TechnicalTerm term={KPI_TERMS[kpi.key]} />}
            </p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">
              {formatKpi(kpi.value, kpi.format, currency)}
            </p>
          </div>
        ))}
      </div>

      {budget && (
        <div className="rounded-[20px] border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex items-center text-sm font-medium">
              Verba do pedido usada
              <TechnicalTerm term="adBudget" />
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {formatMoneyFromCents(budget.spentBrlCents, currency)} de {formatMoneyFromCents(budget.adBudgetBrlCents, "BRL")}
            </p>
          </div>
          {budget.percentUsed === null ? (
            <p className="mt-2 text-xs text-warning">
              A conta não é em reais ({currency}): a comparação com a verba do pedido fica de fora.
            </p>
          ) : (
            <>
              <Progress value={budget.percentUsed} className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                Conta só as campanhas com {orderCode} no nome. Restam{" "}
                {formatMoneyFromCents(budget.remainingBrlCents, "BRL")}.
              </p>
            </>
          )}
        </div>
      )}

      <ServiceFeeSection orderId={orderId} />

      <DailySpendChart series={overview.series} currency={currency} />
      <AccountCampaignList
        campaigns={overview.campaigns}
        currency={currency}
        orderCode={orderCode}
        isTruncated={overview.isTruncated}
      />
      <AccountBreakdownSection source={{ orderId, range }} currency={currency} />
    </div>
  );
}
