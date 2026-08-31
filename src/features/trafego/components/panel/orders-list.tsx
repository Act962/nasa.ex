"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Plus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrafegoOrders } from "@/features/trafego/hooks/use-trafego-orders";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import {
  CAMPAIGN_TYPE_SHORT_LABEL,
  OBJECTIVE_LABEL,
  PLATFORM_SHORT_LABEL,
} from "@/features/trafego/lib/catalog-labels";
import { OrderStatusBadge } from "./order-status-badge";

export function TrafegoOrdersList() {
  const { data: orders, isLoading } = useTrafegoOrders();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando suas campanhas…
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Rocket className="mx-auto size-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Nenhuma campanha ainda</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Contrate um plano e nossa equipe coloca sua campanha no ar.
        </p>
        <Button asChild className="mt-6">
          <Link href="/trafego">
            <Plus className="mr-1.5 size-4" />
            Nova campanha
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Minhas campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o andamento e o desempenho de cada uma.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/trafego">
            <Plus className="mr-1.5 size-4" />
            Nova campanha
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/trafego/painel/${order.id}`}
            className="group rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {order.code}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-1.5 font-semibold">{order.planNameSnapshot}</p>
                <p className="text-sm text-muted-foreground">
                  {PLATFORM_SHORT_LABEL[order.platform]} ·{" "}
                  {CAMPAIGN_TYPE_SHORT_LABEL[order.campaignType]} ·{" "}
                  {OBJECTIVE_LABEL[order.objective]}
                </p>
              </div>

              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {formatBrlFromCents(order.totalBrlCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBrlFromCents(order.adBudgetBrlCents)} em verba
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {order.creativesCount}/{order.maxCreatives} criativos
              </span>
              <span>
                {order.copiesCount}/{order.maxCopies} copies
              </span>
              <span>{order.durationDays} dias</span>
              <span className="ml-auto inline-flex items-center gap-1 text-primary opacity-0 transition group-hover:opacity-100">
                Abrir
                <ArrowRight className="size-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
