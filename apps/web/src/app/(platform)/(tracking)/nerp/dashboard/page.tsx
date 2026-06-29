"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NerpShell } from "../../../../../features/nerp/components/nerp-shell";
import { NerpConnectionGuard } from "../../../../../features/nerp/components/connection-guard";
import { useNerpDashboard } from "../../../../../features/nerp/hooks/use-nerp-dashboard";

function formatNumber(n: number | undefined) {
  return typeof n === "number" ? n.toLocaleString("pt-BR") : "—";
}

function formatCurrency(n: number | undefined) {
  return typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
}

function DeltaBadge({ value, label }: { value: number; label: string }) {
  const positive = value > 0;
  return (
    <span className="text-xs text-muted-foreground">
      {value === 0 ? (
        <>Sem variação {label}</>
      ) : (
        <>
          <span className={positive ? "text-emerald-600" : "text-red-600"}>
            {positive ? "+" : ""}
            {formatNumber(value)}
          </span>{" "}
          {label}
        </>
      )}
    </span>
  );
}

export default function NerpDashboardPage() {
  const query = useNerpDashboard();
  const data = query.data;

  return (
    <NerpShell
      title="Dashboard nerp"
      description="Resumo do dia: vendas, produtos, estoque e últimas movimentações."
      actions={
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
        {data && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Receita total</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatCurrency(data.salesTotal)}
                  </CardTitle>
                  <DeltaBadge
                    value={data.totalSinceLastMonth}
                    label="mês passado"
                  />
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Vendas hoje</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(data.salesToday)}
                  </CardTitle>
                  <DeltaBadge
                    value={data.salesFromYesterdayToToday}
                    label="vs. ontem"
                  />
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Produtos ativos</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(data.productsActive)}
                  </CardTitle>
                  <DeltaBadge
                    value={data.productAddedToday}
                    label="adicionados hoje"
                  />
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Estoque baixo</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatNumber(data.productsLowStock)}
                  </CardTitle>
                  <DeltaBadge
                    value={data.lowStockFromYesterdayToToday}
                    label="vs. ontem"
                  />
                </CardHeader>
              </Card>
            </div>

            {data.latestSales.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Últimas vendas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {data.latestSales.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">{s.product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.customer.name} · {s.quantity} un
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{s.status}</Badge>
                          <span className="font-medium">
                            {formatCurrency(s.total)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {data.productWithLowStock.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Produtos com estoque baixo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {data.productWithLowStock.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.sku && (
                            <div className="text-xs text-muted-foreground">
                              SKU {p.sku}
                            </div>
                          )}
                        </div>
                        <span className="text-xs">
                          <span className="font-medium">{formatNumber(p.stock)}</span>
                          <span className="text-muted-foreground">
                            {" "}/ mín {formatNumber(p.stockMin)}
                          </span>
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
