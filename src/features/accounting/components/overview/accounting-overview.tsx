"use client";

import { AlertTriangle, ArrowRight, CalendarClock, FileStack, Loader2, Receipt, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAccountingOverview } from "@/features/accounting/hooks/use-accounting-overview";
import { useRunAssessment } from "@/features/accounting/hooks/use-accounting-assessments";
import { formatCentsBrl } from "@/features/accounting/lib/format";
import {
  REGIME_LABELS,
  REGIME_TERM_IDS,
  daysUntilFiscalDate,
  describeDaysUntil,
  formatFiscalDate,
  formatPeriodLabel,
} from "@/features/accounting/lib/profile/tax-display";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { ObligationStatusBadge } from "../calendar/obligation-status-badge";

interface AccountingOverviewProps {
  onNavigate?: (section: string) => void;
}

function scoreTone(scorePercent: number) {
  if (scorePercent >= 85) return { stroke: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Em dia" };
  if (scorePercent >= 60) return { stroke: "stroke-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Atenção" };
  return { stroke: "stroke-red-500", text: "text-red-600 dark:text-red-400", label: "Risco" };
}

function ScoreGauge({ scorePercent }: { scorePercent: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(100, Math.max(0, scorePercent));
  const tone = scoreTone(clampedPercent);
  return (
    <div className="relative size-28 shrink-0" role="img" aria-label={`Score de regularidade: ${clampedPercent}%`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clampedPercent / 100)}
          className={cn("transition-all duration-700", tone.stroke)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold tabular-nums", tone.text)}>{clampedPercent}%</span>
        <span className="text-[11px] text-muted-foreground">{tone.label}</span>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}

/** Painel inicial da aba Contábil: saúde fiscal, próximos prazos e atalhos. */
export function AccountingOverview({ onNavigate }: AccountingOverviewProps) {
  const overviewQuery = useAccountingOverview();
  const runAssessment = useRunAssessment();
  const navigate = (section: string) => onNavigate?.(section);

  if (overviewQuery.isLoading) return <OverviewSkeleton />;
  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <Card className="py-0">
        <CardContent className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">Não foi possível carregar a visão geral agora. Tente de novo em instantes.</p>
          <Button size="sm" variant="outline" onClick={() => overviewQuery.refetch()}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const overview = overviewQuery.data;
  const scorePercent = Math.round(overview.scoreBps / 100);
  const totalCreditsCents = overview.availableCredits.cbsCents + overview.availableCredits.ibsCents;
  const lastMonthLabel = formatPeriodLabel(overview.lastMonth.period);

  function handleRunLastMonth() {
    runAssessment.mutate(
      { periodMonth: overview.lastMonth.period },
      {
        onSuccess: () => {
          toast.success(`Impostos de ${lastMonthLabel} calculados. Confira antes de gerar a guia.`);
          navigate("assessments");
        },
        onError: (error) => toast.error(error.message || "Não foi possível apurar agora."),
      },
    );
  }

  return (
    <div className="space-y-4">
      {!overview.isOnboarded && (
        <Card className="border-violet-500/30 bg-violet-500/5 py-0">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-4 text-violet-600" />
                Bem-vindo à aba Contábil
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Calcula os impostos do mês a partir do que você já lança no financeiro e gera a guia como conta a pagar.</li>
                <li>Avisa os prazos fiscais pelo WhatsApp e guarda documentos e certidões da empresa num só lugar.</li>
                <li>Faz a contabilidade (balancete e balanço) sozinha e explica cada termo em linguagem simples.</li>
              </ul>
            </div>
            <Button className="shrink-0 gap-1.5 bg-violet-600 text-white hover:bg-violet-700" onClick={() => navigate("profile")}>
              Configurar perfil fiscal
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        Regime atual:
        <span className="font-medium text-foreground">{REGIME_LABELS[overview.regime]}</span>
        <FiscalTermHint termId={REGIME_TERM_IDS[overview.regime]} />
        <button type="button" className="ml-1 text-xs text-violet-600 hover:underline dark:text-violet-300" onClick={() => navigate("profile")}>
          alterar
        </button>
      </div>

      {overview.paidWithoutInvoiceCount > 0 && (
        <button
          type="button"
          onClick={() => navigate("credits")}
          className="flex w-full items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-left text-sm text-amber-900 transition-colors hover:bg-amber-500/15 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">
            <strong>
              {overview.paidWithoutInvoiceCount} {overview.paidWithoutInvoiceCount === 1 ? "despesa paga sem nota" : "despesas pagas sem nota"}
            </strong>{" "}
            = crédito de imposto perdido. Anexe a nota fiscal para recuperar.
          </span>
          <ArrowRight className="mt-0.5 size-4 shrink-0" />
        </button>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="gap-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <ShieldCheck className="size-4 text-violet-600" />
              Score de regularidade
              <FiscalTermHint termId="score-regularidade" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <ScoreGauge scorePercent={scorePercent} />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {overview.pendingItemsCount} {overview.pendingItemsCount === 1 ? "pendência" : "pendências"} ·{" "}
                <span className={cn(overview.blockingCount > 0 && "font-medium text-red-600 dark:text-red-400")}>
                  {overview.blockingCount} {overview.blockingCount === 1 ? "impedimento" : "impedimentos"}
                </span>
              </p>
              {overview.overdueObligationsCount > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {overview.overdueObligationsCount} {overview.overdueObligationsCount === 1 ? "obrigação atrasada" : "obrigações atrasadas"}
                </p>
              )}
              <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate("documents")}>
                Ver documentos
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Receipt className="size-4 text-violet-600" />
              Guia de {lastMonthLabel}
              <FiscalTermHint termId="competencia" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!overview.lastMonth.hasAssessment ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Os impostos do mês passado ainda não foram calculados. Leva segundos e nada é pago sem você confirmar.
                </p>
                <Button
                  size="sm"
                  className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
                  disabled={runAssessment.isPending}
                  onClick={handleRunLastMonth}
                >
                  {runAssessment.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Apurar agora
                </Button>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">{formatCentsBrl(overview.lastMonth.totalAmountCents)}</p>
                <p className="text-sm text-muted-foreground">
                  {overview.lastMonth.draftCount > 0
                    ? `${overview.lastMonth.draftCount} ${overview.lastMonth.draftCount === 1 ? "cálculo aguardando" : "cálculos aguardando"} sua revisão.`
                    : "Tudo confirmado para este mês."}
                </p>
                <Button
                  size="sm"
                  variant={overview.lastMonth.draftCount > 0 ? "default" : "outline"}
                  className="gap-1"
                  onClick={() => navigate("assessments")}
                >
                  {overview.lastMonth.draftCount > 0 ? "Revisar e gerar guia" : "Ver apurações"}
                  <ArrowRight className="size-3.5" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <FileStack className="size-4 text-violet-600" />
              Créditos de IBS/CBS
              <FiscalTermHint termId="credito-nao-cumulativo" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold tabular-nums">{formatCentsBrl(totalCreditsCents)}</p>
            <p className="text-xs text-muted-foreground">
              CBS {formatCentsBrl(overview.availableCredits.cbsCents)} · IBS {formatCentsBrl(overview.availableCredits.ibsCents)} — valor que
              abate do imposto das suas vendas.
            </p>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate("credits")}>
              Ver créditos
              <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="gap-3 md:col-span-2 xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <CalendarClock className="size-4 text-violet-600" />
              Próximas obrigações
              <FiscalTermHint termId="obrigacao-acessoria" />
            </CardTitle>
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => navigate("calendar")}>
              Calendário
              <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {overview.nextObligations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum prazo pendente. {overview.isOnboarded ? "Tudo em dia!" : "Configure o perfil fiscal para montarmos seu calendário."}
              </p>
            ) : (
              <ul className="divide-y">
                {overview.nextObligations.map((obligation) => {
                  const daysUntil = daysUntilFiscalDate(obligation.dueDate);
                  return (
                    <li key={obligation.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{obligation.label}</p>
                        <p className="text-xs text-muted-foreground">Competência {formatPeriodLabel(obligation.period)}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                        <span className="tabular-nums">{formatFiscalDate(obligation.dueDate)}</span>
                        <span
                          className={cn(
                            "text-muted-foreground",
                            daysUntil < 0 && "text-red-600 dark:text-red-400",
                            daysUntil >= 0 && daysUntil <= 2 && "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {describeDaysUntil(daysUntil)}
                        </span>
                        <ObligationStatusBadge status={obligation.status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
