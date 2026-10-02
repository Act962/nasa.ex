"use client";

/**
 * Vendas do criador: "Confirmadas" (matrículas pagas) e "Pendentes"
 * (checkouts iniciados que ainda não viraram matrícula).
 */

import { useState } from "react";
import { Sparkles, TrendingUp, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useNasaRouteSales,
  useNasaRoutePendingSales,
} from "@/features/nasa-route/hooks/use-nasa-route-sales";
import { NasaRoutePageTop } from "../shared/nasa-route-page-top";
import { SearchPill } from "../shared/search-pill";
import { useNasaRouteCreatorDock } from "../../hooks/use-nasa-route-dock";
import { SalesKpiCard, formatBrl } from "./sales-shared";
import { SalesConfirmedList } from "./sales-confirmed-list";
import { SalesPendingList } from "./sales-pending-list";

export function SalesTable() {
  useNasaRouteCreatorDock("sales");
  const [search, setSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");

  const salesQuery = useNasaRouteSales({
    search: search || undefined,
    pageSize: 100,
  });
  const pendingQuery = useNasaRoutePendingSales({
    search: pendingSearch || undefined,
    pageSize: 100,
  });

  const sales = salesQuery.data?.sales ?? [];
  const totals = salesQuery.data?.totals;
  const pending = pendingQuery.data?.pending ?? [];
  const pendingCounts = pendingQuery.data?.countsByStatus ?? {};

  const pendingHotCount = (pendingCounts["PENDING"] ?? 0) + (pendingCounts["PAID"] ?? 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-2 pb-[150px] md:py-8 lg:pb-10">
      <NasaRoutePageTop
        icon={<TrendingUp />}
        title="Vendas"
        subtitle="Acompanhe as matrículas pagas e as compras ainda em aberto."
        mobileSubtitle="Pagas e em aberto"
      />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:mt-6">
        <SalesKpiCard
          icon={<TrendingUp />}
          label="Total faturado"
          value={salesQuery.isLoading ? null : formatBrl(totals?.paidBrlCents ?? 0)}
          tone="success"
          className="max-sm:col-span-2"
        />
        <SalesKpiCard
          icon={<Users />}
          label="Vendas confirmadas"
          value={salesQuery.isLoading ? null : (totals?.count ?? 0).toLocaleString("pt-BR")}
          tone="info"
        />
        <SalesKpiCard
          icon={<Sparkles />}
          label="Repasse em Stars"
          value={salesQuery.isLoading ? null : `${(totals?.payoutStars ?? 0).toLocaleString("pt-BR")} ★`}
          tone="warning"
        />
      </div>

      <Tabs defaultValue="confirmed" className="mt-5 md:mt-6">
        <TabsList className="h-10 w-full md:w-auto">
          <TabsTrigger value="confirmed" className="flex-1 md:flex-none">
            Confirmadas
            {totals?.count != null && (
              <span className="ml-1.5 text-xs opacity-70">{totals.count}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex-1 md:flex-none">
            Pendentes
            {pendingHotCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[10px] font-semibold text-white">
                {pendingHotCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="confirmed" className="mt-3 space-y-3 md:mt-4">
          <SearchPill value={search} onChange={setSearch} placeholder="Buscar por nome ou email…" />
          <SalesConfirmedList sales={sales} isLoading={salesQuery.isLoading} />
        </TabsContent>

        <TabsContent value="pending" className="mt-3 space-y-3 md:mt-4">
          <SearchPill value={pendingSearch} onChange={setPendingSearch} placeholder="Buscar por email…" />
          <SalesPendingList pending={pending} isLoading={pendingQuery.isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
