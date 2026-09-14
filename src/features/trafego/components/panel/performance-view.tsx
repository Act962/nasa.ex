"use client";

import { BarChart3, Clock, Loader2, LinkIcon, Radio } from "lucide-react";
import { useTrafegoOrderPerformance } from "@/features/trafego/hooks/use-trafego-orders";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { Progress } from "@/components/ui/progress";

type KpiFormat = "int" | "currency" | "pct";

function formatValue(value: number, format: KpiFormat): string {
  if (format === "currency") return formatBrlFromCents(value);
  if (format === "pct") return `${value.toFixed(2).replace(".", ",")}%`;
  return Math.round(value).toLocaleString("pt-BR");
}

export function PerformanceView({ orderId }: { orderId: string }) {
  const { data, isLoading } = useTrafegoOrderPerformance(orderId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Carregando desempenho…
      </div>
    );
  }

  if (!data) return null;

  if (!data.hasMetrics) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <BarChart3 className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">
          {data.reason === "not_linked"
            ? "Os números aparecem quando a campanha entrar no ar"
            : "Ainda coletando os primeiros dados"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {data.reason === "not_linked"
            ? "Assim que nossa equipe publicar sua campanha, o desempenho passa a ser atualizado aqui todos os dias."
            : "As métricas da plataforma são consolidadas uma vez por dia. Volte em algumas horas."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DataFreshness
        source={data.source}
        updatedAt={"updatedAt" in data ? data.updatedAt : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((kpi) => (
          <div key={kpi.key} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatValue(kpi.value, kpi.format as KpiFormat)}
            </p>
          </div>
        ))}
      </div>

      {data.budget.adBudgetBrlCents > 0 && data.budget.spentBrlCents > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">Verba consumida</p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {formatBrlFromCents(data.budget.spentBrlCents)} de{" "}
              {formatBrlFromCents(data.budget.adBudgetBrlCents)}
            </p>
          </div>
          <Progress value={data.budget.percentUsed} className="mt-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            Restam {formatBrlFromCents(data.budget.remainingBrlCents)} de verba.
          </p>
        </div>
      )}

      {data.series.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">Evolução diária</p>
          <div className="mt-4 flex h-32 items-end gap-1">
            {data.series.map((point) => {
              const max = Math.max(...data.series.map((row) => row.primary), 1);
              const height = Math.max(4, (point.primary / max) * 100);
              return (
                <div
                  key={String(point.date)}
                  className="flex-1 rounded-t bg-primary/70"
                  style={{ height: `${height}%` }}
                  title={`${new Date(point.date).toLocaleDateString("pt-BR")}: ${point.primary.toLocaleString("pt-BR")} impressões`}
                />
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <LinkIcon className="size-3" />
            Impressões por dia no período
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * De quando é o número. "Ao vivo" aparece nas primeiras horas de uma campanha,
 * antes do primeiro fechamento diário — dizer isso evita o cliente achar que o
 * painel travou quando o valor mudar de um refresh para o outro.
 */
function DataFreshness({
  source,
  updatedAt,
}: {
  source: "live" | "snapshot";
  updatedAt?: Date | string | null;
}) {
  const isLive = source === "live";
  const Icon = isLive ? Radio : Clock;

  const label = isLive
    ? "Ao vivo — direto da plataforma, ainda sem o fechamento do dia"
    : updatedAt
      ? `Consolidado em ${new Date(updatedAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        })} — a plataforma fecha os números uma vez por dia`
      : "Consolidado uma vez por dia pela plataforma";

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className={isLive ? "size-3.5 text-emerald-500" : "size-3.5"} />
      {label}
    </p>
  );
}
