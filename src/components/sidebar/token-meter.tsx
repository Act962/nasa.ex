"use client";

/**
 * Token Meter — medidor de consumo de tokens das LLMs (Chatbot IA +
 * workflows agent-mode + qualquer outro callsite).
 *
 * Diferente do `StarsMeter`:
 *   - Stars  = créditos NASA (abstração interna por ação)
 *   - Tokens = unidade real cobrada pelos providers (OpenAI/Anthropic/
 *              Google). Custo real em $$$.
 *
 * Display compacto (sidebar): ícone Brain + total tokens + trend %.
 * Click → popover com:
 *   - Tokens totais ciclo + custo R$ estimado
 *   - Tendência vs ciclo anterior
 *   - Top 3 modelos (atalho)
 *   - Botão "Mais informações" → abre `TokenUsageDialog`
 *
 * Reusa `orpc.ia.usage.overview` (org-wide, ciclo de 30d).
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Brain, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { orpc } from "@/lib/orpc";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBrl, formatTokens } from "@/features/ia/lib/token-pricing";
import { TokenUsageDialog } from "@/features/ia/components/token-usage-dialog";

const PROVIDER_LABELS: Record<string, string> = {
  NASA_DEFAULT: "NASA (default)",
  OPENAI: "OpenAI (custom)",
  ANTHROPIC: "Anthropic (custom)",
  GOOGLE: "Google (custom)",
};

export function TokenMeter() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: overview } = useQuery({
    ...orpc.ia.usage.overview.queryOptions(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!overview) return null;

  const { currentCycle, trend, byProvider, byModel, totalRuns } = overview;
  const tokens = currentCycle.totalTokens;
  const cost = currentCycle.costBrl;
  const trendTokens = trend.tokensPct;

  // Cor do indicador: vermelho se subiu >50%, verde se caiu ou estável,
  // amarelo entre 20-50%. Não tem "budget" intrínseco (tokens não têm
  // limite tipo Stars), então usamos trend como sinal de anomalia.
  const trendColor =
    trendTokens === null
      ? "text-muted-foreground"
      : trendTokens > 50
        ? "text-red-500"
        : trendTokens > 20
          ? "text-yellow-500"
          : trendTokens < -10
            ? "text-emerald-500"
            : "text-muted-foreground";

  const trendIcon =
    trendTokens === null ? null : trendTokens > 0 ? (
      <TrendingUp className="size-3" />
    ) : (
      <TrendingDown className="size-3" />
    );

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <SidebarMenuButton
                tooltip={`Tokens IA: ${formatTokens(tokens)} (${formatBrl(cost)}) no ciclo`}
                className={cn(
                  "data-[state=open]:bg-accent",
                  collapsed && "justify-center",
                )}
              >
                <Brain className="size-4 shrink-0" />
                {!collapsed && (
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-foreground/80 font-medium truncate">
                        Tokens IA
                      </span>
                      <span className="tabular-nums text-foreground/90">
                        {formatTokens(tokens)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-muted-foreground tabular-nums">
                        {formatBrl(cost)}
                      </span>
                      {trendTokens !== null && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 tabular-nums",
                            trendColor,
                          )}
                        >
                          {trendIcon}
                          {Math.abs(Math.round(trendTokens))}%
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent
              side="right"
              align="end"
              className="w-80 p-0"
              sideOffset={8}
            >
              <div className="p-4 space-y-3">
                {/* Header */}
                <div>
                  <p className="text-xs text-muted-foreground">
                    Tokens IA no ciclo (30d)
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold tabular-nums">
                      {formatTokens(tokens)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      tokens
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                      {totalRuns} chamadas
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {currentCycle.inputTokens.toLocaleString("pt-BR")} input ·{" "}
                    {currentCycle.outputTokens.toLocaleString("pt-BR")} output
                  </p>
                </div>

                {/* Custo + trend */}
                <div className="rounded-md border bg-card p-3 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">
                      Custo estimado
                    </span>
                    <span className="text-xl font-bold tabular-nums">
                      {formatBrl(cost)}
                    </span>
                  </div>
                  {trendTokens !== null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        Vs ciclo anterior
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 tabular-nums",
                          trendColor,
                        )}
                      >
                        {trendIcon}
                        {trendTokens > 0 ? "+" : ""}
                        {Math.round(trendTokens)}%
                      </span>
                    </div>
                  )}
                  {trendTokens !== null && trendTokens > 50 && (
                    <div className="flex items-start gap-1.5 text-[10px] text-red-600 dark:text-red-400 mt-1 pt-1 border-t">
                      <AlertTriangle className="size-3 shrink-0 mt-0.5" />
                      <span>
                        Consumo cresceu &gt;50% — verifique se algum workflow
                        está em loop ou houve aumento de tráfego.
                      </span>
                    </div>
                  )}
                </div>

                {/* Top 3 modelos atalho */}
                {byModel.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      Top modelos
                    </p>
                    {byModel.slice(0, 3).map((m) => {
                      const pct = tokens > 0 ? (m.tokens / tokens) * 100 : 0;
                      return (
                        <div
                          key={m.modelId}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="truncate font-mono text-[11px]">
                            {m.modelId}
                          </span>
                          <div className="flex items-center gap-2 shrink-0 text-[11px]">
                            <span className="text-muted-foreground tabular-nums">
                              {Math.round(pct)}%
                            </span>
                            <span className="tabular-nums w-16 text-right">
                              {formatTokens(m.tokens)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Providers ativos */}
                {byProvider.length > 1 && (
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {byProvider.map((p) => (
                      <span
                        key={p.provider}
                        className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                      >
                        {PROVIDER_LABELS[p.provider] ?? p.provider}:{" "}
                        {formatTokens(p.tokens)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Botão Mais informações */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setPopoverOpen(false);
                    setDialogOpen(true);
                  }}
                >
                  Mais informações
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </SidebarMenuItem>
      </SidebarMenu>

      <TokenUsageDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
