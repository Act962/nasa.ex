"use client";

import Link from "next/link";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiConsumptionReport } from "@/features/ia/hooks/use-ai-resources";
import type { AiReportPeriod } from "@/features/ia/lib/ai-use-groups";
import { formatBrl } from "@/features/ia/lib/format-brl";
import { cn } from "@/lib/utils";

// Relatório "Consumo de IA" do Insights (spec 0093, RF-7): gasto por dia e a tabela recurso × modelo ×
// quem pagou. Os totais são os mesmos da seção "IA da empresa" em Satélites.

const PERIODS: { id: AiReportPeriod; label: string }[] = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "90d", label: "90 dias" },
];

type AiConsumptionReportData = NonNullable<ReturnType<typeof useAiConsumptionReport>["data"]>;

function formatDay(day: string): string {
  const [, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DailyChart({ daily }: { daily: AiConsumptionReportData["daily"] }) {
  const largestDayCost = Math.max(...daily.map((day) => day.companyCostBrl + day.platformCostBrl), 0);
  if (daily.length === 0 || largestDayCost === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sem gasto registrado no período.</p>;
  return (
    <div>
      <div className="flex h-40 items-end gap-1 overflow-x-auto">
        {daily.map((day) => {
          const dayCost = day.companyCostBrl + day.platformCostBrl;
          return (
            <div
              key={day.day}
              className="flex h-full min-w-3 flex-1 flex-col justify-end"
              title={`${formatDay(day.day)}: ${formatBrl(dayCost)} · ${day.calls.toLocaleString("pt-BR")} usos · ${day.stars.toLocaleString("pt-BR")} Stars`}
            >
              <div className="rounded-t-sm bg-warning" style={{ height: `${(day.platformCostBrl / largestDayCost) * 100}%` }} />
              <div className={cn("bg-info", day.platformCostBrl === 0 && "rounded-t-sm")} style={{ height: `${(day.companyCostBrl / largestDayCost) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{formatDay(daily[0].day)}</span>
        <span>{formatDay(daily[daily.length - 1].day)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-info" /> Chave da empresa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-warning" /> IA da plataforma (Stars)
        </span>
      </div>
    </div>
  );
}

export function AiConsumptionReport() {
  const [period, setPeriod] = useState<AiReportPeriod>("30d");
  const { data: report, isLoading, isError } = useAiConsumptionReport(period);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <h1 className="text-xl font-bold">Consumo de IA</h1>
          <p className="text-sm text-muted-foreground">O que a empresa gastou com IA, por recurso, modelo e quem pagou.</p>
        </div>
        <div className="flex overflow-hidden rounded-full border text-xs" role="tablist" aria-label="Período">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={option.id === period}
              onClick={() => setPeriod(option.id)}
              className={cn("px-3.5 py-1.5 text-muted-foreground", option.id === period && "bg-foreground font-semibold text-background")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isError && <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Só o dono ou um administrador da empresa vê o consumo de IA.</p>}
      {isLoading && <Skeleton className="h-72 w-full rounded-3xl" />}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Gasto total" value={formatBrl(report.totals.costBrl)} hint={`${report.totals.calls.toLocaleString("pt-BR")} usos`} />
            <Kpi label="Na chave da empresa" value={formatBrl(report.totals.companyCostBrl)} hint="Pago direto ao provedor" />
            <Kpi label="Na IA da plataforma" value={formatBrl(report.totals.platformCostBrl)} hint="Custo do que foi cobrado em Stars" />
            <Kpi label="Stars cobradas" value={report.totals.stars.toLocaleString("pt-BR")} />
          </div>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Gasto por dia</h2>
            <DailyChart daily={report.daily} />
          </section>

          <section className="overflow-hidden rounded-3xl border bg-card">
            <h2 className="px-5 pt-5 text-sm font-semibold">Por recurso, modelo e quem pagou</h2>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-y bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-semibold">Recurso</th>
                    <th className="px-3 py-2 font-semibold">Modelo</th>
                    <th className="px-3 py-2 font-semibold">Quem pagou</th>
                    <th className="px-3 py-2 text-right font-semibold">Usos</th>
                    <th className="px-3 py-2 text-right font-semibold">Custo</th>
                    <th className="px-5 py-2 text-right font-semibold">Stars</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((line) => (
                    <tr key={[line.app, line.resourceLabel, line.trackingName, line.modelId, line.paidBy].join("|")} className="border-b last:border-b-0">
                      <td className="px-5 py-2.5">
                        <p className="font-medium">
                          {line.resourceLabel}
                          {line.trackingName && <span className="font-normal text-muted-foreground"> · {line.trackingName}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{line.app}</p>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{line.modelName ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", line.paidBy === "company" ? "bg-info/10 text-info" : "bg-warning/15 text-warning")}>
                          {line.paidBy === "company" ? "Chave da empresa" : "Plataforma"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{line.calls.toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                        {formatBrl(line.costBrl)}
                        {line.unpricedCalls > 0 && <span className="font-normal text-muted-foreground"> (parcial)</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{line.stars.toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {report.lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                        Nenhum uso de IA registrado no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Valores estimados pela tabela de preços, não pela fatura do provedor.
            {report.totals.unpricedCalls > 0 ? ` ${report.totals.unpricedCalls.toLocaleString("pt-BR")} usos (voz por minuto, por exemplo) ainda não têm preço na tabela e ficaram fora do custo.` : ""}{" "}
            Os recursos só passaram a registrar uso por completo em 11/10/2026: períodos anteriores aparecem incompletos.{" "}
            <Link href="/integrations#ia-da-empresa" className="font-medium text-primary hover:underline">
              Ver chaves e modelos em Satélites
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
