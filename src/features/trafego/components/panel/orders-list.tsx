"use client";

import { AstroSymbolIcon } from "@/components/astro-symbol-icon";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenIcon,
  MegaphoneIcon,
  Plus,
  Rocket,
  SearchIcon,
} from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTrafegoOrders } from "@/features/trafego/hooks/use-trafego-orders";
import { usePanelPath } from "@/features/trafego/lib/base-path";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  ORDER_FILTER_KEYS,
  ORDER_FILTER_LABEL,
  countsAsInvestment,
  matchesOrderFilter,
  orderNeedsClientAction,
  type OrderFilterKey,
} from "@/features/trafego/lib/order-filters";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { OrderCard } from "./order-card";
import { PanelPageHeader } from "./panel-page-header";
import { PanelStatGrid, type PanelStat } from "./panel-stat-grid";

const NEW_CAMPAIGN_HREF = "/trafego?nova=1#montar";

export function TrafegoOrdersList() {
  const { data: orders, isLoading } = useTrafegoOrders();
  const panelPath = usePanelPath();
  const [activeFilter, setActiveFilter] = useState<OrderFilterKey>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const allOrders = useMemo(() => orders ?? [], [orders]);
  const needsYouCount = allOrders.filter((order) =>
    orderNeedsClientAction(order.status),
  ).length;

  useRegisterOrbitDock({
    leftItems: [
      { label: "Início", href: "/home?home=1", icon: <AstroSymbolIcon /> },
      {
        label: "Campanhas",
        href: panelPath,
        icon: <MegaphoneIcon />,
        isActive: true,
        badgeCount: needsYouCount || undefined,
      },
    ],
    rightItems: [
      { label: "Nova", href: NEW_CAMPAIGN_HREF, icon: <Plus /> },
      {
        label: "Como funciona",
        href: "/trafego#como-funciona",
        icon: <BookOpenIcon />,
      },
    ],
  });

  const stats = useMemo<PanelStat[]>(() => {
    const investedOrders = allOrders.filter((order) =>
      countsAsInvestment(order.status),
    );
    const adBudgetCents = investedOrders.reduce(
      (total, order) => total + order.adBudgetBrlCents,
      0,
    );
    const totalPaidCents = investedOrders.reduce(
      (total, order) => total + order.totalBrlCents,
      0,
    );
    const liveCount = allOrders.filter(
      (order) => order.status === "RUNNING",
    ).length;
    return [
      {
        key: "adBudget",
        label: "Verba nos anúncios",
        value: formatBrlFromCents(adBudgetCents),
        term: "adBudget",
      },
      {
        key: "totalPaid",
        label: "Total investido",
        value: formatBrlFromCents(totalPaidCents),
      },
      { key: "live", label: "No ar agora", value: String(liveCount) },
      {
        key: "needsYou",
        label: "Precisam de você",
        value: String(needsYouCount),
      },
    ];
  }, [allOrders, needsYouCount]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleOrders = allOrders.filter(
    (order) =>
      matchesOrderFilter(order.status, activeFilter) &&
      (normalizedSearch.length === 0 ||
        order.code.toLowerCase().includes(normalizedSearch) ||
        order.planNameSnapshot.toLowerCase().includes(normalizedSearch)),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pt-2 pb-6 max-lg:pb-40 md:px-6 md:pt-6">
      <PanelPageHeader
        title="Minhas campanhas"
        mobileTitle="Campanhas"
        subtitle="Acompanhe o andamento e o desempenho de cada uma."
        mobileSubtitle="Andamento e resultados dos seus anúncios"
        actions={
          <Button
            asChild
            className="h-11 w-full rounded-full md:h-9 md:w-auto"
            data-guide={GUIDE_ANCHORS.trafegoNewCampaign.id}
          >
            <Link href={NEW_CAMPAIGN_HREF}>
              <Plus className="mr-1.5 size-4" />
              Nova campanha
            </Link>
          </Button>
        }
      />

      {!isLoading && <PanelStatGrid stats={stats} className="mt-4 md:mt-6" />}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <OrbitaSpinner className="size-4" />
          Carregando suas campanhas…
        </div>
      ) : allOrders.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed px-6 py-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
            <Rocket className="size-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-base font-semibold">
            Nenhuma campanha ainda
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Escolha quanto quer investir e nossa equipe coloca seu anúncio no
            ar.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-full md:max-w-sm md:order-2">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar pelo código ou plano"
                aria-label="Buscar campanha"
                className="h-11 rounded-full pl-10 md:h-9"
              />
            </div>
            <div className="scroll-hidden-x -mx-4 flex gap-2 px-4 md:mx-0 md:flex-wrap md:px-0">
              {ORDER_FILTER_KEYS.map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setActiveFilter(filterKey)}
                  aria-pressed={activeFilter === filterKey}
                  className={cn(
                    "h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition",
                    activeFilter === filterKey
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ORDER_FILTER_LABEL[filterKey]}
                  {filterKey === "needsYou" && needsYouCount > 0 && (
                    <span className="ml-1.5 tabular-nums">{needsYouCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <div className="mt-4 rounded-[22px] border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              Nenhuma campanha neste filtro.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {visibleOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  href={`${panelPath}/${order.id}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
