"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, BookOpenIcon, MegaphoneIcon, PlugZap, Plus, Radio, SearchIcon } from "lucide-react";
import { AstroSymbolIcon } from "@/components/astro-symbol-icon";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTrafegoAccountCampaigns } from "@/features/trafego/hooks/use-trafego-account";
import { usePanelPath } from "@/features/trafego/lib/base-path";
import type { AccountPeriodSelection } from "@/features/trafego/lib/order-meta-metrics";
import { TechnicalTerm } from "../../technical-term";
import { PanelPageHeader } from "../panel-page-header";
import { PanelViewTabs } from "../panel-view-tabs";
import { AccountBreakdownSection, DailySpendChart } from "../account-performance-sections";
import { KPI_TERMS, formatKpi } from "../account-performance-view";
import { AccountCampaignRow, type AccountCampaignRowData } from "./account-campaign-row";
import { AccountPeriodPicker } from "./account-period-picker";

/** Conta de anúncios inteira: todas as campanhas, conjuntos e anúncios, inclusive os de fora do trafeGO. */

/** A lista inteira já vem do servidor (filtro, busca e ordem precisam dela); a tela mostra aos poucos. */
const CAMPAIGNS_PAGE_SIZE = 20;

const CAMPAIGN_FILTERS = ["delivering", "active", "paused", "all"] as const;
type CampaignFilter = (typeof CAMPAIGN_FILTERS)[number];

const CAMPAIGN_FILTER_LABEL: Record<CampaignFilter, string> = {
  delivering: "Com resultado no período",
  active: "No ar",
  paused: "Pausadas",
  all: "Todas",
};

function matchesCampaignFilter(campaign: AccountCampaignRowData, filter: CampaignFilter): boolean {
  if (filter === "active") return campaign.status === "ACTIVE";
  if (filter === "paused") return campaign.status === "PAUSED" || campaign.status === "CAMPAIGN_PAUSED";
  if (filter === "delivering") return campaign.metrics.spendCents > 0 || campaign.status === "ACTIVE";
  return true;
}

export function AccountExplorerView() {
  const [period, setPeriod] = useState<AccountPeriodSelection>({ range: "last_30d" });
  const [activeFilter, setActiveFilter] = useState<CampaignFilter>("delivering");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(CAMPAIGNS_PAGE_SIZE);
  const panelPath = usePanelPath();
  const { data, isLoading, isPlaceholderData } = useTrafegoAccountCampaigns(period);

  useRegisterOrbitDock({
    leftItems: [
      { label: "Início", href: "/home?home=1", icon: <AstroSymbolIcon /> },
      { label: "Campanhas", href: panelPath, icon: <MegaphoneIcon />, isActive: true },
    ],
    rightItems: [
      { label: "Nova", href: "/trafego?nova=1#montar", icon: <Plus /> },
      { label: "Como funciona", href: "/trafego#como-funciona", icon: <BookOpenIcon /> },
    ],
  });

  const campaigns = useMemo(() => (data?.mode === "account" ? data.campaigns : []), [data]);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCampaigns = campaigns.filter(
    (campaign) =>
      matchesCampaignFilter(campaign, activeFilter) &&
      (normalizedSearch.length === 0 || campaign.name.toLowerCase().includes(normalizedSearch)),
  );
  const visibleCampaigns = filteredCampaigns.slice(0, visibleCount);
  const hiddenCount = filteredCampaigns.length - visibleCampaigns.length;

  function resetPaging() {
    setVisibleCount(CAMPAIGNS_PAGE_SIZE);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-6 max-lg:pb-40 md:px-6 md:pt-6">
      <PanelPageHeader
        title="Conta de anúncios"
        mobileTitle="Conta de anúncios"
        subtitle="Todas as campanhas da sua conta na Meta, inclusive as criadas fora do trafeGO."
        mobileSubtitle="Todas as campanhas da sua conta na Meta"
      />
      <PanelViewTabs active="account" className="mt-4" />

      {isLoading || !data ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <OrbitaSpinner className="size-4" />
          Lendo a conta de anúncios…
        </div>
      ) : data.mode === "not_connected" ? (
        <div className="mt-6 rounded-[22px] border border-dashed px-6 py-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
            <PlugZap className="size-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Conecte sua conta de anúncios</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Com a Meta conectada nas integrações, todas as campanhas da conta aparecem aqui com os números do
            Gerenciador.
          </p>
          <Button asChild className="mt-4 rounded-full">
            <Link href="/integrations">Ir para integrações</Link>
          </Button>
        </div>
      ) : data.mode === "unavailable" ? (
        <div className="mt-6 flex items-start gap-2 rounded-[20px] border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>{data.message}</p>
        </div>
      ) : (
        <div className={cn("mt-5 space-y-5 transition-opacity", isPlaceholderData && "opacity-60")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radio className="size-3.5 text-success" />
              {data.account.name} · {data.account.currency} ·{" "}
              {isPlaceholderData ? (
                <span className="inline-flex items-center gap-1">
                  <OrbitaSpinner className="size-3" /> atualizando o período…
                </span>
              ) : (
                <>
                  atualizado às{" "}
                  {new Date(data.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </>
              )}
            </p>
            <AccountPeriodPicker
              value={period}
              onChange={(nextPeriod) => {
                setPeriod(nextPeriod);
                resetPaging();
              }}
            />
          </div>

          {data.account.accountStatus !== 1 && (
            <p className="flex items-center gap-1.5 rounded-[16px] border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              <AlertTriangle className="size-3.5 text-warning" />
              Conta de anúncios: {data.account.statusLabel}.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
            {data.kpis.map((kpi) => (
              <div key={kpi.key} className="min-w-0 rounded-[18px] border bg-card px-3.5 py-3">
                <p className="text-[12px] text-muted-foreground">
                  {kpi.label}
                  {KPI_TERMS[kpi.key] && <TechnicalTerm term={KPI_TERMS[kpi.key]} />}
                </p>
                <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">
                  {formatKpi(kpi.value, kpi.format, data.account.currency)}
                </p>
              </div>
            ))}
          </div>

          <DailySpendChart series={data.series} currency={data.account.currency} />

          <section className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-sm font-semibold">
                Campanhas <span className="font-normal text-muted-foreground">({filteredCampaigns.length})</span>
              </h2>
              <div className="relative md:w-full md:max-w-xs">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    resetPaging();
                  }}
                  placeholder="Buscar campanha"
                  aria-label="Buscar campanha"
                  className="h-10 rounded-full pl-10 md:h-9"
                />
              </div>
            </div>
            <div className="scroll-hidden-x -mx-4 flex gap-2 px-4 md:mx-0 md:flex-wrap md:px-0">
              {CAMPAIGN_FILTERS.map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => {
                    setActiveFilter(filterKey);
                    resetPaging();
                  }}
                  aria-pressed={activeFilter === filterKey}
                  className={cn(
                    "h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition",
                    activeFilter === filterKey
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {CAMPAIGN_FILTER_LABEL[filterKey]}
                </button>
              ))}
            </div>

            {filteredCampaigns.length === 0 ? (
              <div className="rounded-[22px] border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
                Nenhuma campanha neste filtro.
              </div>
            ) : (
              <div className="grid gap-3">
                {visibleCampaigns.map((campaign) => (
                  <AccountCampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    currency={data.account.currency}
                    period={period}
                  />
                ))}
              </div>
            )}
            {hiddenCount > 0 && (
              <div className="flex flex-col items-center gap-1.5 pt-1">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setVisibleCount((current) => current + CAMPAIGNS_PAGE_SIZE)}
                >
                  Ver mais {Math.min(hiddenCount, CAMPAIGNS_PAGE_SIZE)} campanhas
                </Button>
                <p className="text-xs text-muted-foreground">
                  Mostrando {visibleCampaigns.length} de {filteredCampaigns.length}
                </p>
              </div>
            )}
            {data.isTruncated && (
              <p className="text-xs text-muted-foreground">
                A conta tem muitas campanhas: mostrando as mais recentes e as que gastaram no período.
              </p>
            )}
          </section>

          <AccountBreakdownSection source={{ accountPeriod: period }} currency={data.account.currency} />
        </div>
      )}
    </div>
  );
}
