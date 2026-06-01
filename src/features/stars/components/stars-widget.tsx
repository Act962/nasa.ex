"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StarIcon } from "./star-icon";
import { StarsPurchaseModal } from "./stars-purchase-modal";
import { SubscriptionPlansModal } from "./subscription-plans-modal";
import { StarsHistoryDialog } from "./stars-history-dialog";
import { History, Plus, TrendingUp, AlertTriangle, Zap, Sparkles, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Consumed bar ─────────────────────────────────────────────────────────────

function ConsumedBar({
  consumed,
  total,
  isCritical,
  isLow,
}: {
  consumed: number;
  total: number;
  /** Saldo total disponível < threshold crítico — força vermelho. */
  isCritical?: boolean;
  /** Saldo total disponível < threshold baixo — força amarelo. */
  isLow?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, (consumed / total) * 100) : 0;
  // Cor reflete RISCO REAL de acabar (saldo total), não % consumido.
  // Estourar o plano mensal com bonus disponível NÃO deve disparar
  // vermelho — só quando o saldo cair de fato.
  const color = isCritical
    ? "bg-red-500"
    : isLow
      ? "bg-amber-500"
      : pct >= 100
        ? // Estourou plano mas saldo OK: roxo indica "consumindo bonus"
          "bg-[#7C3AED]"
        : pct >= 70
          ? "bg-yellow-400"
          : "bg-[#7C3AED]";

  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({
  planSlug,
  planName,
}: {
  planSlug: string;
  planName: string;
}) {
  const colors: Record<string, string> = {
    earth: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    explore: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    constellation: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  };
  return (
    <span
      className={cn(
        "text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide",
        colors[planSlug] ?? "bg-muted text-muted-foreground",
      )}
    >
      {planName}
    </span>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function StarsWidget() {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [allAppsOpen, setAllAppsOpen] = useState(false);

  const queryClient = useQueryClient();

  // ── Retorno do Stripe Checkout (?stars=success|cancelled) ──────────────────
  // O crédito acontece de forma assíncrona via webhook; aqui só damos feedback
  // e fazemos polling do saldo por alguns segundos até refletir o crédito.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("stars");
    if (status !== "success" && status !== "cancelled") return;

    params.delete("stars");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );

    if (status === "cancelled") {
      toast.info("Pagamento cancelado.");
      return;
    }

    toast.success("Pagamento recebido! Creditando suas Stars…");
    const balanceKey = orpc.stars.getBalance.queryOptions().queryKey;
    let attempts = 0;
    const iv = setInterval(() => {
      attempts += 1;
      queryClient.invalidateQueries({ queryKey: balanceKey });
      if (attempts >= 6) clearInterval(iv);
    }, 2000);
    return () => clearInterval(iv);
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    refetchInterval: 15_000,
    staleTime: 0,
  });

  // Novo: consumo real do ciclo + breakdown por app/usuário.
  // Usado pra calcular `consumed` corretamente (antes era confundido
  // com saldo) e popular a seção "Uso do plano por app".
  const { data: usage } = useQuery({
    ...orpc.stars.getUsageBreakdown.queryOptions(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <div className="h-8 w-32 rounded-lg bg-muted/60 animate-pulse" />;
  }

  const balance = data?.balance ?? 0;
  const bonusBalance = data?.bonusBalance ?? 0;

  // Plano vem SEMPRE da organização (via `stars.getBalance` → checkBalance(org.id)).
  // NÃO usamos mais `authClient.subscription.list()`: aquele plugin better-auth/stripe
  // resolve `referenceId` como userId (sem `authorizeReference`), o que divergia do
  // plano real da org (que mora em `Organization.planId`) e ainda vazava entre orgs ao
  // trocar a org ativa. Fonte única de verdade = org.
  const planName = data?.planName ?? "";
  const planSlug = data?.planSlug ?? "free";
  const planMonthlyStars = data?.planMonthlyStars ?? 0;

  // hasPlan é true quando a org tem um plano válido (slug != free).
  const hasPlan = planSlug !== "free" && planMonthlyStars > 0;

  // SUITE = pay-per-use (consumo livre). Não tem limite mensal pra mostrar
  // como `X / Y` — só mostra o consumido + saldo.
  const isPayPerUse = planSlug === "suite";

  // Consumed agora vem do agregado real de débitos no ciclo (via
  // `stars.getUsageBreakdown`). NÃO confunde mais com saldo restante —
  // o bug do `consumed = balance` está corrigido aqui.
  const consumed = usage?.consumedInCycle ?? 0;
  // Saldo restante = direto do `org.starsBalance` (não calculado).
  const remaining = balance;
  // Mostra barra/% só pros planos com limite definido + cycleStart populado.
  // **FIX CRÍTICO**: sem `cycleStart` (org nova ou plano sem ciclo iniciado),
  // não calcula `pctUsed` e não dispara o alerta vermelho indevido.
  const cycleStart = data?.cycleStart;
  const showLimitBar =
    hasPlan && !isPayPerUse && planMonthlyStars > 0 && !!cycleStart;
  const pctUsed = showLimitBar ? (consumed / planMonthlyStars) * 100 : 0;
  // **FIX**: isLow/isCritical agora refletem RISCO REAL de acabar, não
  // simplesmente % consumido do plano. Antes, consumir 330% do plano
  // ficava vermelho mesmo com 997k de saldo restante — confunde o user.
  //
  // Total disponível = balance regular + bonus (pode ser sacado pra
  // cobrir consumo após estourar o plano mensal). Threshold é o MAIOR
  // entre absoluto (50/200 stars) e relativo (5%/20% do plano) — cobre
  // tanto orgs com plano pequeno quanto grande.
  const totalAvailable = remaining + bonusBalance;
  const criticalThreshold = Math.max(50, planMonthlyStars * 0.05);
  const lowThreshold = Math.max(200, planMonthlyStars * 0.2);
  const isCritical = showLimitBar && totalAvailable < criticalThreshold;
  const isLow =
    showLimitBar && !isCritical && totalAvailable < lowThreshold;
  // Flag separado pra indicar visualmente "estourou o plano mas tem
  // reserva" — bar fica roxa (info) em vez de vermelha (alerta).
  const overplan = showLimitBar && consumed > planMonthlyStars;

  // Grace period / suspended — vindos do backend (get-balance estendido).
  const graceStartedAt = data?.graceStartedAt
    ? new Date(data.graceStartedAt)
    : null;
  const suspendedAt = data?.suspendedAt
    ? new Date(data.suspendedAt)
    : null;
  const daysInGrace = graceStartedAt
    ? Math.floor(
        (Date.now() - graceStartedAt.getTime()) / (24 * 60 * 60 * 1000),
      )
    : 0;
  const daysLeftGrace = Math.max(0, 15 - daysInGrace);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* ── Stars counter pill ── */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-all focus-visible:outline-none",
                isCritical
                  ? "border-red-400/50 bg-red-500/10 text-red-500 hover:bg-red-500/15"
                  : isLow
                    ? "border-amber-400/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15"
                    : "border-border/60 bg-background hover:bg-muted/60 text-foreground",
              )}
            >
              {isCritical || isLow ? (
                <AlertTriangle className="size-3.5 shrink-0" />
              ) : (
                <StarIcon className="size-3.5 shrink-0" />
              )}
              {showLimitBar ? (
                <>
                  <span className="tabular-nums">
                    {consumed.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-muted-foreground font-normal hidden sm:inline">
                    /
                  </span>
                  <span className="tabular-nums text-muted-foreground font-normal hidden sm:inline">
                    {planMonthlyStars.toLocaleString("pt-BR")}
                  </span>
                </>
              ) : (
                // SUITE / free: mostra só o saldo no pill (sem /limite)
                <span className="tabular-nums">
                  {balance.toLocaleString("pt-BR")}
                </span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-72 p-0 overflow-hidden shadow-xl border-border/60"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b bg-linear-to-br from-[#7C3AED]/8 to-transparent">
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Stars consumidas
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(true)}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-[#7C3AED] hover:text-[#6D28D9] hover:bg-[#7C3AED]/10 rounded px-1.5 py-0.5 transition-colors"
                    title="Ver histórico completo de consumo"
                  >
                    <History className="size-3" />
                    Histórico
                  </button>
                  {hasPlan && (
                    <PlanBadge planSlug={planSlug} planName={planName} />
                  )}
                </div>
              </div>

              {showLimitBar ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <StarIcon className="size-5 mb-0.5" />
                    <span className="text-3xl font-extrabold tabular-nums leading-none">
                      {consumed.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-base text-muted-foreground font-normal">
                      / {planMonthlyStars.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Saldo restante:{" "}
                    <strong>{remaining.toLocaleString("pt-BR")} ★</strong>
                  </p>
                </>
              ) : isPayPerUse ? (
                // SUITE: pay-per-use. Mostra consumo do ciclo + saldo, sem /limite.
                <>
                  <div className="flex items-baseline gap-1">
                    <StarIcon className="size-5 mb-0.5" />
                    <span className="text-3xl font-extrabold tabular-nums leading-none">
                      {consumed.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-xs text-muted-foreground">no ciclo</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Saldo:{" "}
                    <strong>{balance.toLocaleString("pt-BR")} ★</strong>{" "}
                    · consumo livre
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <StarIcon className="size-4" />
                  <span>Sem plano ativo</span>
                </div>
              )}

              {bonusBalance > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3 text-[#7C3AED]" />
                  <span>
                    + <strong>{bonusBalance.toLocaleString("pt-BR")} ★</strong>{" "}
                    de bônus
                    <span className="opacity-70"> · não vale em cursos</span>
                  </span>
                </p>
              )}
            </div>

            {/* Bar + stats */}
            <div className="px-4 py-3 space-y-3">
              {showLimitBar && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Consumo do ciclo</span>
                    <span
                      className={cn(
                        "font-semibold",
                        isCritical
                          ? "text-red-500"
                          : isLow
                            ? "text-amber-500"
                            : "text-foreground",
                      )}
                    >
                      {Math.round(pctUsed)}%
                    </span>
                  </div>
                  <ConsumedBar
                    consumed={consumed}
                    total={planMonthlyStars}
                    isCritical={isCritical}
                    isLow={isLow}
                  />
                </div>
              )}

              {isPayPerUse && consumed > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Plano <strong>SUITE</strong> · consumo livre · ★ {consumed.toLocaleString("pt-BR")} no ciclo
                </div>
              )}

              {/* Uso do plano por app — top 5 + link "Ver todos" pra abrir
                  modal com a lista completa quando a org tem >5 apps com
                  consumo. */}
              {usage?.byApp && usage.byApp.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      Uso do plano por app
                    </p>
                    {usage.byApp.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setAllAppsOpen(true)}
                        className="text-[10px] text-[#7C3AED] hover:underline"
                      >
                        Ver todos ({usage.byApp.length})
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {usage.byApp.slice(0, 5).map((app) => {
                      const pct = showLimitBar
                        ? (app.total / planMonthlyStars) * 100
                        : (app.total / Math.max(consumed, 1)) * 100;
                      return (
                        <div key={app.appSlug} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium truncate">{app.label}</span>
                            <span className="text-muted-foreground tabular-nums shrink-0">
                              {app.total} ★
                              {showLimitBar ? ` (${pct.toFixed(0)}%)` : ""}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-yellow-500"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isCritical && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200/60 p-2.5 dark:bg-red-950/20 dark:border-red-900/40">
                  <AlertTriangle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                    Saldo crítico! Integrações podem ser pausadas em breve.
                  </p>
                </div>
              )}

              {isLow && !isCritical && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200/60 p-2.5 dark:bg-amber-950/20 dark:border-amber-900/40">
                  <Zap className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Saldo total ficando baixo (
                    {totalAvailable.toLocaleString("pt-BR")} ★). Considere
                    recarregar.
                  </p>
                </div>
              )}

              {overplan && !isLow && !isCritical && (
                <div className="flex items-start gap-2 rounded-lg bg-purple-50 border border-purple-200/60 p-2.5 dark:bg-purple-950/20 dark:border-purple-900/40">
                  <Sparkles className="size-3.5 text-[#7C3AED] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed">
                    Você passou do plano mensal, mas seu saldo extra cobre.{" "}
                    {totalAvailable.toLocaleString("pt-BR")} ★ disponíveis.
                  </p>
                </div>
              )}

              {/* Banner persistente durante grace period — após o saldo zerar. */}
              {graceStartedAt && !suspendedAt && (
                <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200/60 p-2.5 dark:bg-orange-950/20 dark:border-orange-900/40">
                  <ShieldAlert className="size-3.5 text-orange-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-orange-700 dark:text-orange-300 leading-relaxed">
                    <strong>Saldo zerou.</strong> Recarregue em <strong>{daysLeftGrace} dias</strong> pra evitar a suspensão da conta. Chat AI já está em modo humano.
                  </div>
                </div>
              )}

              {hasPlan && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">
                      Restante
                    </p>
                    <p className="text-sm font-semibold flex items-center justify-center gap-0.5">
                      <StarIcon className="size-3" />
                      {remaining.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Plano</p>
                    <p className="text-sm font-semibold flex items-center justify-center gap-1">
                      <TrendingUp className="size-3 text-[#7C3AED]" />
                      {planName}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-3 border-t pt-3 space-y-2">
              <Button
                size="sm"
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
                onClick={() => setPurchaseOpen(true)}
              >
                <Plus className="size-3.5" /> Comprar Stars
              </Button>
              <button
                onClick={() => setPlanOpen(true)}
                className="w-full text-center text-[11px] text-[#7C3AED] hover:underline"
              >
                {hasPlan ? "Mudar de plano" : "Ver planos disponíveis"}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* ── Plan badge / Adquirir plano ── */}
        {hasPlan ? (
          <button
            onClick={() => setPlanOpen(true)}
            title={planName}
            className={cn(
              "flex items-center gap-1 h-8 px-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80",
              planSlug === "earth"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : planSlug === "explore"
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
            )}
          >
            <TrendingUp className="size-3 sm:hidden" />
            <span className="hidden sm:block">{planName}</span>
          </button>
        ) : (
          <button
            onClick={() => setPlanOpen(true)}
            title="Adquirir um plano"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-[#7C3AED]/50 bg-[#7C3AED]/5 text-[#7C3AED] text-xs font-semibold hover:bg-[#7C3AED]/10 transition-all"
          >
            <Sparkles className="size-3.5 shrink-0" />
            <span className="sm:hidden">Plano</span>
            <span className="hidden sm:block">Gratuito (Suite)</span>
          </button>
        )}
      </div>

      {/* Modal bloqueante quando a conta entrou em suspensão total — usuário
          só pode interagir com o botão "Comprar Stars" pra reativar. */}
      <Dialog open={!!suspendedAt} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="size-5" />
              Conta suspensa por falta de STARs
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Sua conta entrou em suspensão após o período de carência de 15
              dias com saldo zerado. Todas as integrações pagas estão bloqueadas
              — Chat AI, envio de mensagens, e demais features de cobrança não
              funcionarão até você recarregar.
            </p>
            <p>
              Para reativar imediatamente, compre STARs ou faça upgrade do
              plano.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
              onClick={() => setPurchaseOpen(true)}
            >
              <Plus className="size-3.5" /> Comprar Stars
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setPlanOpen(true)}
            >
              Ver planos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StarsPurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
      />
      <SubscriptionPlansModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        currentPlanSlug={planSlug}
      />
      <StarsHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />

      {/* Modal "Uso do plano por app" — lista completa (todos os apps). */}
      <Dialog open={allAppsOpen} onOpenChange={setAllAppsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StarIcon className="size-4" />
              Uso por app no ciclo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {(usage?.byApp ?? []).map((app) => {
              const pct = showLimitBar
                ? (app.total / planMonthlyStars) * 100
                : (app.total / Math.max(consumed, 1)) * 100;
              return (
                <div key={app.appSlug} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{app.label}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {app.total.toLocaleString("pt-BR")} ★
                      {showLimitBar ? ` (${pct.toFixed(0)}%)` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-[#7C3AED]"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(usage?.byApp ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhum consumo registrado neste ciclo.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
