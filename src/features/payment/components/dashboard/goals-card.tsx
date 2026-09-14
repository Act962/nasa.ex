"use client";

import { Target, PiggyBank, Receipt, Settings2, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "../../lib/format";

export interface GoalsCardData {
  revenueTargetCents: number;
  cashReservePercent: number;
  hasRevenueTarget: boolean;
  hasMonthOverride: boolean;
  receivedRevenue: number;
  projectedRevenue: number;
  openPayable: number;
  projectedCash: number;
  reserveTargetNow: number;
  reserveTargetProjected: number;
  reserveGap: number;
  goalProgressPercent: number;
  isGoalReached: boolean;
  isReserveAtRisk: boolean;
}

function ProgressBar({ percent, tone }: { percent: number; tone: "emerald" | "blue" }) {
  const width = Math.min(Math.max(percent, 0), 100);
  const fill = tone === "emerald" ? "bg-emerald-500" : "bg-blue-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function EmptyState({ onConfigure }: { onConfigure?: () => void }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <Target className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Defina a meta do mês</p>
            <p className="text-xs text-muted-foreground">
              Cadastre quanto precisa vender e quanto deve sobrar em caixa para
              acompanhar aqui e receber alertas.
            </p>
          </div>
        </div>
        {onConfigure && (
          <Button size="sm" variant="outline" onClick={onConfigure}>
            <Settings2 className="size-4" />
            Configurar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function GoalsCard({
  data,
  hasCategoryFilter,
  onConfigure,
}: {
  data: GoalsCardData;
  hasCategoryFilter: boolean;
  onConfigure?: () => void;
}) {
  const hasReserve = data.cashReservePercent > 0;

  if (!data.hasRevenueTarget && !hasReserve) {
    return <EmptyState onConfigure={onConfigure} />;
  }

  const reservePercentLabel = `${data.cashReservePercent}% da receita`;
  const missingToGoal = Math.max(data.revenueTargetCents - data.receivedRevenue, 0);
  const reserveFillPercent =
    data.reserveTargetProjected > 0
      ? (data.projectedCash / data.reserveTargetProjected) * 100
      : data.projectedCash >= 0
        ? 100
        : 0;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Meta de vendas */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-500">
              <Target className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Meta de vendas
              </span>
            </div>
            {data.hasRevenueTarget ? (
              <>
                <p className="text-xl font-black tabular-nums">
                  {formatCurrency(data.receivedRevenue)}
                </p>
                <ProgressBar percent={data.goalProgressPercent} tone="emerald" />
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {formatPercent(data.goalProgressPercent, 0)} de{" "}
                  {formatCurrency(data.revenueTargetCents)}
                  {data.isGoalReached
                    ? " — meta batida"
                    : ` — faltam ${formatCurrency(missingToGoal)}`}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem meta definida para este mês.
              </p>
            )}
          </div>

          {/* Reserva de caixa */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-500">
              <PiggyBank className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Reserva de caixa
              </span>
            </div>
            {hasReserve ? (
              <>
                <p
                  className={`text-xl font-black tabular-nums ${
                    data.isReserveAtRisk ? "text-red-500" : "text-blue-500"
                  }`}
                >
                  {formatCurrency(data.projectedCash)}
                </p>
                <ProgressBar percent={reserveFillPercent} tone="blue" />
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  Precisa fechar com {formatCurrency(data.reserveTargetProjected)} (
                  {reservePercentLabel}).{" "}
                  {data.isReserveAtRisk
                    ? `Faltam ${formatCurrency(Math.abs(data.reserveGap))}.`
                    : `Folga de ${formatCurrency(data.reserveGap)}.`}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  Guardado até agora: {formatCurrency(data.reserveTargetNow)} sobre o
                  que já entrou.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem percentual de reserva definido.
              </p>
            )}
          </div>

          {/* Despesa a pagar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-500">
              <Receipt className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Ainda a pagar
              </span>
            </div>
            <p className="text-xl font-black tabular-nums text-red-500">
              {formatCurrency(data.openPayable)}
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              Receita prevista de {formatCurrency(data.projectedRevenue)} no mês.
            </p>
            {data.hasMonthOverride && (
              <p className="text-[11px] text-muted-foreground">
                Meta ajustada só para este mês.
              </p>
            )}
          </div>
        </div>

        {data.isReserveAtRisk && hasReserve && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-xs text-red-400">
              Se tudo que está lançado se confirmar, o mês fecha{" "}
              {formatCurrency(Math.abs(data.reserveGap))} abaixo da reserva.
            </p>
          </div>
        )}

        {hasCategoryFilter && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Metas são da empresa inteira — este bloco ignora o filtro de categoria.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
