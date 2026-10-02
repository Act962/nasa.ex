"use client";

import { BarChart3, Clock, LinkIcon, Radio } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { useTrafegoOrderPerformance } from "@/features/trafego/hooks/use-trafego-orders";
import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { Progress } from "@/components/ui/progress";
import { TechnicalTerm, type TechnicalTermKey } from "../technical-term";

type KpiFormat = "int" | "currency" | "pct";

function formatValue(value: number, format: KpiFormat): string {
  if (format === "currency") return formatBrlFromCents(value);
  if (format === "pct") return `${value.toFixed(2).replace(".", ",")}%`;
  return Math.round(value).toLocaleString("pt-BR");
}

const KPI_TERMS: Record<string, TechnicalTermKey> = {
  impressions: "impression",
  reach: "reach",
  clicks: "click",
  ctr: "ctr",
  leads: "lead",
  conversions: "conversion",
  cpc: "cpc",
};

export function PerformanceView({ orderId }: { orderId: string }) {
  const { data, isLoading } = useTrafegoOrderPerformance(orderId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <OrbitaSpinner className="size-4" />
        Carregando desempenho…
      </div>
    );
  }

  if (!data) return null;

  if (!data.hasMetrics) {
    return (
      <div className="space-y-4">
        <BudgetUsage budget={data.budget} />
        <div className="rounded-[22px] border border-dashed px-6 py-8 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
            <BarChart3 className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium">
            {data.reason === "not_linked"
              ? "Os números aparecem quando a campanha entrar no ar"
              : "Ainda coletando os primeiros dados"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {data.reason === "not_linked"
              ? "Assim que nossa equipe publicar sua campanha, o desempenho passa a ser atualizado aqui todos os dias."
              : "Os números da plataforma são fechados uma vez por dia. Volte em algumas horas."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DataFreshness
        source={data.source}
        updatedAt={"updatedAt" in data ? data.updatedAt : null}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {data.kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="min-w-0 rounded-[18px] border bg-card px-3.5 py-3"
          >
            <p className="text-[12px] text-muted-foreground">
              {kpi.label}
              {KPI_TERMS[kpi.key] && (
                <TechnicalTerm term={KPI_TERMS[kpi.key]} />
              )}
            </p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">
              {formatValue(kpi.value, kpi.format as KpiFormat)}
            </p>
          </div>
        ))}
      </div>

      <BudgetUsage budget={data.budget} />

      {data.series.length > 0 && (
        <div className="rounded-[20px] border bg-card p-4">
          <p className="text-sm font-medium">Evolução diária</p>
          <div className="mt-4 flex h-32 items-end gap-1">
            {data.series.map((point) => {
              const max = Math.max(...data.series.map((row) => row.primary), 1);
              const height = Math.max(4, (point.primary / max) * 100);
              return (
                <div
                  key={String(point.date)}
                  className="flex-1 rounded-t-full bg-primary/70"
                  style={{ height: `${height}%` }}
                  title={`${new Date(point.date).toLocaleDateString("pt-BR")}: ${point.primary.toLocaleString("pt-BR")} impressões`}
                />
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <LinkIcon className="size-3" />
            Impressões por dia no período
            <TechnicalTerm term="impression" />
          </p>
        </div>
      )}
    </div>
  );
}

interface BudgetSummary {
  adBudgetBrlCents: number;
  spentBrlCents: number;
  remainingBrlCents: number;
  percentUsed: number;
}

/** Verba usada sempre à vista — mesmo antes do primeiro real gasto (R$ 0,00). */
function BudgetUsage({ budget }: { budget: BudgetSummary }) {
  return (
    <div className="rounded-[20px] border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center text-sm font-medium">
          Verba usada
          <TechnicalTerm term="adBudget" />
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {formatBrlFromCents(budget.spentBrlCents)} de{" "}
          {formatBrlFromCents(budget.adBudgetBrlCents)}
        </p>
      </div>
      <Progress value={budget.percentUsed} className="mt-3" />
      <p className="mt-2 text-xs text-muted-foreground">
        Restam {formatBrlFromCents(budget.remainingBrlCents)} para os anúncios.
      </p>
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
    ? "Ao vivo — direto da plataforma, ainda sem o fechamento do dia · atualiza sozinho"
    : updatedAt
      ? `Consolidado em ${new Date(updatedAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        })} — a plataforma fecha os números uma vez por dia`
      : "Consolidado uma vez por dia pela plataforma";

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className={isLive ? "size-3.5 text-success" : "size-3.5"} />
      {label}
    </p>
  );
}
