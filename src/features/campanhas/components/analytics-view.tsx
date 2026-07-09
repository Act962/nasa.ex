"use client";

import Link from "next/link";
import { BarChart3, CheckCheck, Eye, Send, TriangleAlert, Users } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useCampanhasAnalytics } from "../hooks/use-campanhas-analytics";
import {
  BROADCAST_STATUS_LABEL,
  BROADCAST_STATUS_STYLE,
} from "../lib/broadcast-status";
import { PageHeader } from "./page-header";

function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", accent ?? "text-muted-foreground")} />
      </div>
      <span className="text-2xl font-semibold tabular-nums tracking-tight">
        {value.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}

function RateBar({
  label,
  part,
  total,
  color,
}: {
  label: string;
  part: number;
  total: number;
  color: string;
}) {
  const value = percent(part, total);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function AnalyticsView() {
  const { data, isLoading } = useCampanhasAnalytics();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const totals = data?.totals;
  const recent = data?.recent ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Visão geral dos disparos das suas campanhas."
      />

      {!totals || totals.campaigns === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-20 text-center">
          <BarChart3 className="size-6 text-muted-foreground" />
          <p className="font-medium">Sem dados ainda</p>
          <p className="text-sm text-muted-foreground">
            Dispare sua primeira campanha para ver as métricas aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Campanhas" value={totals.campaigns} icon={Send} />
            <StatCard
              label="Destinatários"
              value={totals.recipients}
              icon={Users}
            />
            <StatCard
              label="Enviados"
              value={totals.sent}
              icon={Send}
              accent="text-sky-500"
            />
            <StatCard
              label="Entregues"
              value={totals.delivered}
              icon={CheckCheck}
              accent="text-emerald-500"
            />
            <StatCard
              label="Lidos"
              value={totals.read}
              icon={Eye}
              accent="text-violet-500"
            />
            <StatCard
              label="Falhas"
              value={totals.failed}
              icon={TriangleAlert}
              accent="text-red-500"
            />
          </div>

          <div className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Taxas de desempenho</h2>
            <div className="flex flex-col gap-4">
              <RateBar
                label="Entrega (entregues / enviados)"
                part={totals.delivered}
                total={totals.sent}
                color="bg-emerald-500"
              />
              <RateBar
                label="Leitura (lidos / enviados)"
                part={totals.read}
                total={totals.sent}
                color="bg-violet-500"
              />
              <RateBar
                label="Falha (falhas / destinatários)"
                part={totals.failed}
                total={totals.recipients}
                color="bg-red-500"
              />
            </div>
          </div>

          {recent.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Campanhas recentes</h2>
              <div className="flex flex-col gap-2">
                {recent.map((broadcast) => (
                  <Link
                    key={broadcast.id}
                    href={`/campanhas/${broadcast.id}`}
                    className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{broadcast.name}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                            BROADCAST_STATUS_STYLE[broadcast.status] ??
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          {BROADCAST_STATUS_LABEL[broadcast.status] ??
                            broadcast.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {broadcast.sentCount}/{broadcast.totalRecipients} enviados
                        · {broadcast.readCount} lidos
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                      {percent(broadcast.deliveredCount, broadcast.sentCount)}%
                      <span className="ml-1 text-xs font-normal">entrega</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
