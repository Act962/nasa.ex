"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import { NerpConnectionGuard } from "../../../../../features/nerp/components/connection-guard";
import {
  useNerpDashboard,
  type NerpDashboardRange,
} from "../../../../../features/nerp/hooks/use-nerp-dashboard";

function formatNumber(n: number | undefined) {
  return typeof n === "number" ? n.toLocaleString("pt-BR") : "—";
}

function formatCurrency(n: number | undefined) {
  return typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
}

export default function NerpDashboardPage() {
  const [range, setRange] = useState<NerpDashboardRange>("30d");
  const query = useNerpDashboard({ range });

  const totals = query.data?.dashboard.totals ?? {};

  return (
    <NerpShell
      title="Dashboard nerp"
      description="Resumo de receita, vendas, produtos e clientes do período."
      actions={
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as NerpDashboardRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
              <SelectItem value="365d">365 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
        </div>
      }
    >
      <NerpConnectionGuard>
        {query.isLoading && (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-2" />
            Carregando métricas…
          </div>
        )}
        {query.error && (
          <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {(query.error as Error).message}
          </div>
        )}
        {query.data && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Receita</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCurrency(totals.revenue)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Vendas</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(totals.sales)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Produtos</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(totals.products)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Clientes</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(totals.customers)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {query.data.dashboard.topProducts &&
              query.data.dashboard.topProducts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top produtos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {query.data.dashboard.topProducts.map((p) => (
                        <li
                          key={p.productId}
                          className="flex items-center justify-between py-2 text-sm"
                        >
                          <span>{p.name}</span>
                          <span className="text-muted-foreground">
                            {p.units} un · {formatCurrency(p.revenue)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

            {query.data.dashboard.recentSales &&
              query.data.dashboard.recentSales.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Vendas recentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {query.data.dashboard.recentSales.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between py-2 text-sm"
                        >
                          <span className="font-mono text-xs">{s.id}</span>
                          <span>{formatCurrency(s.total)}</span>
                          <span className="text-muted-foreground text-xs">
                            {s.createdAt}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
          </div>
        )}
      </NerpConnectionGuard>
    </NerpShell>
  );
}
