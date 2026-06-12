"use client";

/**
 * Meter de Stars no sidebar — substituto visual do tile enterrado em
 * Insights. Mostra "consumido / plano mensal" com barra colorida por
 * threshold + popover com breakdown por app ao clicar.
 *
 * Threshold de cor (consumo do ciclo / plano):
 *   <50%  verde   (folga)
 *   50-80% amarelo (atenção)
 *   >=80% vermelho (cuidado — perto do limite)
 *
 * Reutiliza:
 *   - `orpc.stars.getBalance`           (balance + planMonthlyStars)
 *   - `orpc.stars.getUsageBreakdown`    (consumedInCycle + byApp)
 *
 * Posição: SidebarFooter entre `NotificationBell` e `NavUser`. Quando
 * a sidebar está colapsada (icon-only), renderiza só o ícone Star com
 * dot colorido — o popover ainda funciona via hover/click.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { orpc } from "@/lib/orpc";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const APP_LABELS: Record<string, string> = {
  forge: "Forge",
  spacetime: "SpaceTime",
  chat: "Chat",
  tracking: "Tracking",
  "nasa-planner": "NASA Planner",
  workspace: "Workspace",
  forms: "Formulários",
  nbox: "N-Box",
  payment: "Pagamentos",
  linnker: "Linnker",
  agent: "Agente IA (workflows)",
  "chat-ai": "Chatbot IA",
  other: "Outros",
};

/**
 * Status do meter — espelha a lógica de `stars-widget.tsx` (popover do
 * header). RISCO REAL é baseado em saldo total disponível, não em %
 * consumido do plano. Estourar o plano com bonus disponível é
 * informativo (roxo), não alarme.
 */
function getStatus(args: {
  totalAvailable: number;
  planLimit: number;
  consumed: number;
}): { color: string; bg: string; label: string } {
  const { totalAvailable, planLimit, consumed } = args;
  const criticalThreshold = Math.max(50, planLimit * 0.05);
  const lowThreshold = Math.max(200, planLimit * 0.2);

  if (totalAvailable < criticalThreshold) {
    return {
      color: "text-red-500",
      bg: "bg-red-500",
      label: "Saldo crítico",
    };
  }
  if (totalAvailable < lowThreshold) {
    return {
      color: "text-amber-500",
      bg: "bg-amber-500",
      label: "Saldo baixo",
    };
  }
  if (consumed > planLimit) {
    // Estourou plano mensal mas saldo extra cobre → informativo (roxo).
    return {
      color: "text-[#7C3AED]",
      bg: "bg-[#7C3AED]",
      label: "Consumindo saldo extra",
    };
  }
  return {
    color: "text-emerald-500",
    bg: "bg-emerald-500",
    label: "Folga",
  };
}

export function StarsMeter() {
  const [open, setOpen] = useState(false);

  const { data: balance } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    // Refresh a cada 60s pra refletir consumo recente
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Só roda o breakdown quando o popover abre — economiza requests.
  const { data: breakdown } = useQuery({
    ...orpc.stars.getUsageBreakdown.queryOptions(),
    enabled: open,
    staleTime: 30_000,
  });

  if (!balance) return null;

  // `balance` (saldo restante) inclui bonus. Pra calcular "% usado do
  // plano", precisamos do consumido — disponível só via breakdown. Como
  // fallback antes do breakdown carregar, derivamos:
  //   estimadoConsumido = max(0, planMonthlyStars - balance)
  // É aproximação porque bonus distorce, mas suficiente pro meter.
  const planLimit = balance.planMonthlyStars || 0;
  const consumed =
    breakdown?.consumedInCycle ??
    Math.max(0, planLimit - (balance.balance ?? 0));
  const percent =
    planLimit > 0 ? Math.min(100, (consumed / planLimit) * 100) : 0;
  const remaining = Math.max(0, planLimit - consumed);

  const isPayPerUse = balance.planSlug === "suite";

  // **FIX**: status agora reflete RISCO REAL de acabar (saldo total
  // disponível), não simplesmente % consumido. Estourar o plano com
  // bonus disponível vira roxo informativo em vez de vermelho alarme.
  // Mesma lógica que o `stars-widget.tsx` do header usa.
  const totalAvailable = (balance.balance ?? 0) + (balance.bonusBalance ?? 0);
  const overplan = consumed > planLimit;
  const thresh = getStatus({ totalAvailable, planLimit, consumed });

  // Alerta visual no canto só dispara em vermelho real (não em overplan
  // com saldo). Antes mostrava AlertTriangle sempre que estourava plano.
  const showAlert =
    thresh.label === "Saldo crítico" || thresh.label === "Saldo baixo";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              tooltip={
                isPayPerUse
                  ? `Pay-per-use — ${consumed.toLocaleString()} Stars no ciclo`
                  : `Stars: ${consumed.toLocaleString()} / ${planLimit.toLocaleString()} (${Math.round(percent)}%)`
              }
              className="data-[state=open]:bg-accent"
            >
              <Sparkles className={cn("size-4 shrink-0", thresh.color)} />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-foreground/80 font-medium truncate">
                    Stars
                  </span>
                  <span className={cn("tabular-nums", thresh.color)}>
                    {isPayPerUse
                      ? `${consumed.toLocaleString()}`
                      : `${Math.round(percent)}%`}
                  </span>
                </div>
                {/* Barra de progresso compacta */}
                {!isPayPerUse && (
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full transition-all", thresh.bg)}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
              {showAlert && (
                <AlertTriangle
                  className={cn(
                    "size-3 shrink-0 group-data-[collapsible=icon]:hidden",
                    thresh.color,
                  )}
                />
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
                  Plano {balance.planName}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold tabular-nums">
                    {consumed.toLocaleString()}
                  </span>
                  {!isPayPerUse && (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-lg text-muted-foreground tabular-nums">
                        {planLimit.toLocaleString()}
                      </span>
                    </>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    Stars no ciclo
                  </span>
                </div>
              </div>

              {/* Barra */}
              {!isPayPerUse && (
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full transition-all", thresh.bg)}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={thresh.color}>
                      {Math.round(percent)}% — {thresh.label}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {remaining.toLocaleString()} restantes
                    </span>
                  </div>
                </div>
              )}

              {/* Saldo bônus */}
              {(balance.bonusBalance ?? 0) > 0 && (
                <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/40 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                  <span>Bônus disponível</span>
                  <span className="tabular-nums font-medium">
                    +{balance.bonusBalance.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Breakdown por app */}
              {breakdown && breakdown.byApp.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    Top consumo por app
                  </p>
                  {breakdown.byApp.slice(0, 5).map((app) => {
                    const appPct =
                      consumed > 0 ? (app.total / consumed) * 100 : 0;
                    return (
                      <div
                        key={app.appSlug}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="truncate">
                          {APP_LABELS[app.appSlug] ?? app.appSlug}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground tabular-nums text-[10px]">
                            {Math.round(appPct)}%
                          </span>
                          <span className="tabular-nums font-medium w-12 text-right">
                            {app.total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Alerta vermelho/amarelo SÓ quando saldo real está baixo */}
              {showAlert && (
                <div
                  className={cn(
                    "rounded-md px-2 py-2 text-[11px] flex items-start gap-1.5",
                    thresh.label === "Saldo crítico"
                      ? "bg-red-50 dark:bg-red-950/30 border border-red-200/40 text-red-700 dark:text-red-400"
                      : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200/40 text-amber-700 dark:text-amber-400",
                  )}
                >
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <div>
                    Saldo total ficando baixo (
                    {totalAvailable.toLocaleString("pt-BR")} ★). Integrações
                    podem ser pausadas em breve.
                  </div>
                </div>
              )}

              {/* Info roxa quando estourou plano mas saldo extra cobre */}
              {overplan && !showAlert && (
                <div className="rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200/40 px-2 py-2 text-[11px] text-purple-700 dark:text-purple-300">
                  <div className="flex items-start gap-1.5">
                    <Sparkles className="size-3.5 shrink-0 mt-0.5" />
                    <div>
                      Você passou do plano mensal, mas seu saldo extra cobre.{" "}
                      {totalAvailable.toLocaleString("pt-BR")} ★ disponíveis.
                    </div>
                  </div>
                </div>
              )}

              {/* Link pro upgrade */}
              <div className="pt-1">
                <Link
                  href="/settings/billing"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Gerenciar plano →
                </Link>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
