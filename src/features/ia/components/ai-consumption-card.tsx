"use client";

import Link from "next/link";
import { AI_USE_GROUPS, type AiUsagePeriod } from "@/features/ia/lib/ai-use-groups";
import { formatBrl } from "@/features/ia/lib/format-brl";
import { cn } from "@/lib/utils";
import type { AiOverview } from "./ai-company-panel";

// Consumo de IA da empresa no topo de "IA da empresa" (spec 0093, RF-10): total do período e uma
// barra por uso, separando o que saiu da chave da empresa do que foi cobrado em Stars.

const PERIODS: { id: AiUsagePeriod; label: string; sentence: string }[] = [
  { id: "today", label: "Hoje", sentence: "hoje" },
  { id: "7d", label: "7 dias", sentence: "nos últimos 7 dias" },
  { id: "month", label: "Este mês", sentence: "este mês" },
];

interface GroupTotal {
  calls: number;
  costBrl: number;
  ownKeyCostBrl: number;
  stars: number;
  unpricedCalls: number;
}

const EMPTY_TOTAL: GroupTotal = { calls: 0, costBrl: 0, ownKeyCostBrl: 0, stars: 0, unpricedCalls: 0 };

function paidByLabel(total: GroupTotal): string {
  if (total.calls === 0) return "sem uso";
  if (total.stars > 0 && total.ownKeyCostBrl > 0) return `sua chave e ${total.stars.toLocaleString("pt-BR")} Stars`;
  if (total.stars > 0) return `plataforma · ${total.stars.toLocaleString("pt-BR")} Stars`;
  return total.ownKeyCostBrl > 0 ? "sua chave" : "plataforma";
}

export function AiConsumptionCard({ overview, period, onPeriodChange }: { overview: AiOverview; period: AiUsagePeriod; onPeriodChange: (period: AiUsagePeriod) => void }) {
  const totalsByGroup = new Map<string, GroupTotal>();
  for (const row of overview.rows) {
    const total = totalsByGroup.get(row.useGroup) ?? EMPTY_TOTAL;
    totalsByGroup.set(row.useGroup, {
      calls: total.calls + row.usage.calls,
      costBrl: total.costBrl + row.usage.costBrl,
      ownKeyCostBrl: total.ownKeyCostBrl + row.usage.ownKeyCostBrl,
      stars: total.stars + row.usage.stars,
      unpricedCalls: total.unpricedCalls + row.usage.unpricedCalls,
    });
  }
  const groupTotals = [...totalsByGroup.values()];
  const totalCost = groupTotals.reduce((sum, total) => sum + total.costBrl, 0);
  const ownKeyCost = groupTotals.reduce((sum, total) => sum + total.ownKeyCostBrl, 0);
  const totalStars = groupTotals.reduce((sum, total) => sum + total.stars, 0);
  const hasPartialCost = groupTotals.some((total) => total.unpricedCalls > 0);
  const largestCost = Math.max(...groupTotals.map((total) => total.costBrl), 0);
  const periodSentence = PERIODS.find((option) => option.id === period)?.sentence ?? "";

  return (
    <div className="px-5 py-5">
      <div className="mb-2 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <h3 className="text-lg font-semibold">
            Você gastou {formatBrl(totalCost)} com IA {periodSentence}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatBrl(ownKeyCost)} na sua chave · {totalStars.toLocaleString("pt-BR")} Stars na IA da plataforma
          </p>
        </div>
        <div className="flex overflow-hidden rounded-full border text-xs" role="tablist" aria-label="Período">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={option.id === period}
              onClick={() => onPeriodChange(option.id)}
              className={cn("px-3.5 py-1.5 text-muted-foreground", option.id === period && "bg-foreground font-semibold text-background")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {AI_USE_GROUPS.map((group) => {
        const total = totalsByGroup.get(group.id) ?? EMPTY_TOTAL;
        const barPercent = largestCost > 0 ? Math.max((total.costBrl / largestCost) * 100, total.calls > 0 ? 2 : 0) : 0;
        return (
          <div key={group.id} className="grid items-center gap-x-4 gap-y-1 border-t py-3 text-sm first:border-t-0 sm:grid-cols-[1.3fr_2fr_1fr]">
            <div>
              <p className="font-medium">{group.label}</p>
              <p className="text-xs text-muted-foreground">
                {total.calls.toLocaleString("pt-BR")} {group.unitLabel}
              </p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-info" style={{ width: `${barPercent}%` }} />
            </div>
            <div className="text-xs text-muted-foreground sm:text-right">
              <p className="text-sm font-semibold text-foreground">{formatBrl(total.costBrl)}</p>
              {paidByLabel(total)}
            </div>
          </div>
        );
      })}

      <p className="mt-2 text-xs text-muted-foreground">
        Valores estimados pela tabela de preços, não pela fatura do provedor.
        {hasPartialCost ? " Parte do uso (voz por minuto, por exemplo) ainda não tem preço na tabela e ficou fora do total." : ""} Nem todo recurso registra uso ainda: o total
        pode ser menor que o real.{" "}
        <Link href="/insights/relatorios/consumo-ia" className="font-medium text-primary hover:underline">
          Ver por dia, funil e modelo em Insights
        </Link>
      </p>
    </div>
  );
}
