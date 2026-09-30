"use client";

import { ArrowDownRight, ArrowUpRight, Minus, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRegularityHistory, useRegularityScore } from "@/features/accounting/hooks/use-accounting-compliance";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { RegularityHistoryChart } from "./regularity-history-chart";
import { formatScorePercent, scoreTone } from "./document-display";

function LargeScoreGauge({ scorePercent }: { scorePercent: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(100, Math.max(0, scorePercent));
  const tone = scoreTone(clampedPercent);
  return (
    <div className="relative size-36 shrink-0 sm:size-40" role="img" aria-label={`Score de regularidade: ${clampedPercent}%`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clampedPercent / 100)}
          className={cn("transition-all duration-700", tone.stroke)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold tabular-nums", tone.text)}>{clampedPercent}%</span>
        <span className="text-xs text-muted-foreground">{tone.label}</span>
      </div>
    </div>
  );
}

function ScoreDelta({ scoreBps, previousScoreBps }: { scoreBps: number; previousScoreBps: number | null }) {
  if (previousScoreBps === null) {
    return <p className="text-xs text-muted-foreground">O histórico começa a aparecer a partir de amanhã.</p>;
  }
  const deltaPoints = formatScorePercent(scoreBps) - formatScorePercent(previousScoreBps);
  const DeltaIcon = deltaPoints > 0 ? ArrowUpRight : deltaPoints < 0 ? ArrowDownRight : Minus;
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        deltaPoints > 0 && "text-emerald-600 dark:text-emerald-400",
        deltaPoints < 0 && "text-red-600 dark:text-red-400",
        deltaPoints === 0 && "text-muted-foreground",
      )}
    >
      <DeltaIcon className="size-3.5" />
      {deltaPoints === 0 ? "Igual a 30 dias atrás" : `${deltaPoints > 0 ? "+" : ""}${deltaPoints} pontos em 30 dias`}
    </p>
  );
}

export function RegularityDashboard() {
  const { data: score, isLoading, isError } = useRegularityScore();
  const { data: history } = useRegularityHistory(90);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (isError || !score) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Não foi possível calcular o score agora. Recarregue a página em instantes.
        </CardContent>
      </Card>
    );
  }

  const scorePercent = formatScorePercent(score.scoreBps);
  const tone = scoreTone(scorePercent);
  const historyPoints = history?.points ?? [];

  return (
    <Card className="border-violet-500/20">
      <CardContent className="grid gap-6 py-5 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3 sm:flex-row lg:flex-col">
          <LargeScoreGauge scorePercent={scorePercent} />
          <div className="space-y-1.5 text-center sm:text-left lg:text-center">
            <p className="flex items-center justify-center gap-1 text-sm font-semibold sm:justify-start lg:justify-center">
              Score de regularidade <FiscalTermHint termId="score-regularidade" />
            </p>
            <p className="text-xs text-muted-foreground">
              {score.okCount} de {score.applicableCount} documentos em dia
            </p>
            <ScoreDelta scoreBps={score.scoreBps} previousScoreBps={score.previousScoreBps} />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {score.blockingCount > 0 ? (
            <div className="flex gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-500" />
              <div className="text-sm">
                <p className="font-semibold text-red-700 dark:text-red-300">
                  {score.blockingCount} {score.blockingCount === 1 ? "impedimento" : "impedimentos"} agora
                </p>
                <p className="text-muted-foreground">
                  São documentos críticos vencidos ou faltando. Enquanto não forem resolvidos, a empresa pode ficar
                  fora de licitações, ter crédito negado no banco ou não conseguir emitir nota.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                Nenhum impedimento: os documentos críticos estão em dia. Mantenha as datas de validade atualizadas.
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Últimos 90 dias</p>
            {historyPoints.length >= 2 ? (
              <RegularityHistoryChart points={historyPoints} strokeColor={tone.hex} />
            ) : (
              <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                O gráfico aparece depois de alguns dias de acompanhamento — o score é registrado uma vez por dia.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
