"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { usePageAnalytics } from "../../hooks/use-pages";
import { usePagesOrbitDock } from "../../hooks/use-pages-orbit-dock";
import { CreatePageWizard } from "../wizard/create-page-wizard";

/**
 * Visitas e cliques de um site — agregação de NasaPageVisit (`pages.getAnalytics`):
 * KPIs, profundidade de rolagem, cliques, seções, origem e dispositivos.
 */

const PERIOD_OPTIONS_DAYS = [7, 30, 90] as const;

export function PageAnalyticsView({ pageId }: { pageId: string }) {
  const [days, setDays] = useState<number>(30);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const { data, isLoading } = usePageAnalytics(pageId, days);
  usePagesOrbitDock({ activeSection: "analytics", onCreateSite: () => setIsWizardOpen(true) });
  const createPageWizard = <CreatePageWizard open={isWizardOpen} onOpenChange={setIsWizardOpen} />;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <OrbitaSpinner className="size-8" />
        {createPageWizard}
      </div>
    );
  }
  if (!data) return createPageWizard;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-28 md:gap-6 md:px-6 md:py-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            asChild
            size="icon"
            variant="ghost"
            className="size-10 shrink-0 rounded-full bg-knob"
            aria-label="Voltar para o editor"
            title="Voltar para o editor"
          >
            <Link href={`/pages/${pageId}`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15 max-md:hidden">
            <BarChart3 className="size-5 text-info" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:text-2xl">Visitas e cliques</h1>
            <p className="line-clamp-2 text-xs text-muted-foreground md:text-sm">
              Como as pessoas usaram o site nos últimos {data.sinceDays} dias.
            </p>
          </div>
        </div>
        <div className="flex w-full gap-1 rounded-full bg-muted p-1 md:w-auto">
          {PERIOD_OPTIONS_DAYS.map((periodDays) => (
            <button
              key={periodDays}
              type="button"
              onClick={() => setDays(periodDays)}
              className={cn(
                "h-9 flex-1 rounded-full px-4 text-sm transition-colors md:flex-none",
                days === periodDays ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {periodDays} dias
            </button>
          ))}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Kpi label="Visitas totais" value={data.totalVisits.toLocaleString("pt-BR")} />
        <Kpi
          label="Tempo médio"
          value={formatDuration(data.avgDwellSeconds)}
        />
        <Kpi
          label="Chegaram ao fim"
          value={`${data.scrollDepth.p100}%`}
          hint="Rolaram a página até o final"
        />
        <Kpi
          label="Eventos registrados"
          value={data.eventsTotal.toLocaleString("pt-BR")}
        />
      </div>

      {/* Scroll funnel */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">Até onde rolaram a página</p>
          <div className="space-y-2">
            {(
              [
                ["25%", data.scrollDepth.p25],
                ["50%", data.scrollDepth.p50],
                ["75%", data.scrollDepth.p75],
                ["100%", data.scrollDepth.p100],
              ] as const
            ).map(([markerLabel, pct]) => (
              <div key={markerLabel} className="flex items-center gap-3">
                <span className="text-xs w-12 text-muted-foreground">{markerLabel}</span>
                <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-chart-1 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-12 text-right">
                  {pct}%
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            % de visitantes que chegaram a cada ponto da página. Quedas grandes
            mostram onde o conteúdo perde a atenção.
          </p>
        </CardContent>
      </Card>

      {/* Devices */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">Dispositivos</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(data.byDevice).map(([deviceName, visitCount]) => (
              <Badge key={deviceName} variant="outline" className="gap-1.5 rounded-full py-1">
                <span className="font-semibold">{visitCount}</span>
                <span className="text-muted-foreground">·</span>
                <span className="capitalize">{deviceName}</span>
              </Badge>
            ))}
            {Object.keys(data.byDevice).length === 0 && (
              <p className="text-xs text-muted-foreground">Sem dados</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top clicks */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">
            Elementos mais clicados
          </p>
          {data.topClicked.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem cliques registrados ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topClicked.map((row) => (
                <div
                  key={row.targetId}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <code className="font-mono truncate text-muted-foreground">
                    {row.targetId}
                  </code>
                  <span className="font-semibold tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top sections */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">
            Seções mais vistas
          </p>
          {data.topSections.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem dados ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topSections.map((row) => (
                <div
                  key={row.targetId}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <code className="font-mono truncate text-muted-foreground">
                    #{row.targetId}
                  </code>
                  <span className="font-semibold tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top referrers */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">Origem do tráfego</p>
          {data.topReferrers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <div className="space-y-2">
              {data.topReferrers.map((row) => (
                <div
                  key={row.host}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="truncate">{row.host}</span>
                  <span className="font-semibold tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        Mapa de calor (onde as pessoas tocam na tela) — em breve.
      </p>
      {createPageWizard}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="rounded-[18px]">
      <CardContent className="p-3 md:p-4">
        <p className="truncate text-[12px] text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-bold md:text-2xl">{value}</p>
        {hint && (
          <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
