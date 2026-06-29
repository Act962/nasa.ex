"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Página de Analytics — agregação de NasaPageVisit em métricas
 * visuais. Mostra cards de KPIs, scroll funnel, top clicks, top
 * sections, top referrers, distribuição por device.
 *
 * Tudo via 1 query oRPC (`pages.getAnalytics`). Sem heatmap visual
 * por enquanto (precisaria de tracking de coordenadas X/Y por
 * elemento — próxima iteração com model dedicado).
 */
export function PageAnalyticsView({ pageId }: { pageId: string }) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery(
    orpc.pages.getAnalytics.queryOptions({
      input: { id: pageId, days },
    }),
  );

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button asChild variant="ghost" size="sm" className="gap-1 mb-2 -ml-2">
            <Link href={`/pages/${pageId}`}>
              <ArrowLeft className="size-4" />
              Voltar pro editor
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="size-6 text-violet-500" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas dos últimos {data.sinceDays} dias.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Visitas totais" value={data.totalVisits.toLocaleString("pt-BR")} />
        <Kpi
          label="Tempo médio"
          value={formatDuration(data.avgDwellSeconds)}
        />
        <Kpi
          label="Chegaram ao fim"
          value={`${data.scrollDepth.p100}%`}
          hint="Scrollaram 100%"
        />
        <Kpi
          label="Eventos registrados"
          value={data.eventsTotal.toLocaleString("pt-BR")}
        />
      </div>

      {/* Scroll funnel */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">Profundidade de scroll</p>
          <div className="space-y-2">
            {(
              [
                ["25%", data.scrollDepth.p25],
                ["50%", data.scrollDepth.p50],
                ["75%", data.scrollDepth.p75],
                ["100%", data.scrollDepth.p100],
              ] as const
            ).map(([lbl, pct]) => (
              <div key={lbl} className="flex items-center gap-3">
                <span className="text-xs w-12 text-muted-foreground">{lbl}</span>
                <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all"
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
            % de visitantes que cruzaram cada marker. Quedas grandes entre
            marcadores indicam onde o conteúdo perde atenção.
          </p>
        </CardContent>
      </Card>

      {/* Devices */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">Dispositivos</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(data.byDevice).map(([d, c]) => (
              <Badge key={d} variant="outline" className="gap-1.5 py-1">
                <span className="font-semibold">{c}</span>
                <span className="text-muted-foreground">·</span>
                <span className="capitalize">{d}</span>
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
            Seções mais vistas (entraram no viewport)
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
        Hot map visual completo (mapa de calor com coordenadas X/Y) requer
        modelo dedicado de eventos — em breve.
      </p>
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
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-black mt-1">{value}</p>
        {hint && (
          <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}
