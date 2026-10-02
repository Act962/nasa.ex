"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { ChevronDown, ChevronLeft, ChevronRight, Receipt, RotateCcw } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useAccountingAssessments,
  useConfirmAssessment,
  useReopenAssessment,
  useRunAssessment,
} from "@/features/accounting/hooks/use-accounting-assessments";
import { formatBps, formatCentsBrl, shiftMonthKey } from "@/features/accounting/lib/format";
import {
  TAX_DISPLAY_LABELS,
  TAX_TERM_IDS,
  TEST_YEAR_REFORM,
  formatFiscalDate,
  formatPeriodLabel,
  previousMonthKey,
} from "@/features/accounting/lib/profile/tax-display";
import { FiscalTermHint } from "../shared/fiscal-term-hint";
import { CalculationMemo } from "../shared/calculation-memo";

const calculationMemoSchema = z.object({
  steps: z.array(
    z.object({
      label: z.string(),
      formula: z.string().optional(),
      value: z.string(),
      legalSource: z.string().optional(),
      termId: z.string().optional(),
    }),
  ),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })).default([]),
  sources: z.array(z.string()).default([]),
});

const ASSESSMENT_STATUS_DISPLAY = {
  DRAFT: { label: "Rascunho", className: "border-warning/30 bg-warning/10 text-warning dark:text-warning" },
  CONFIRMED: { label: "Confirmada", className: "border-info/30 bg-info/10 text-info dark:text-info" },
  PAID: { label: "Paga", className: "border-success/30 bg-success/10 text-success dark:text-success" },
  CANCELLED: { label: "Cancelada", className: "border-border bg-muted text-muted-foreground" },
} as const;

type AssessmentList = NonNullable<ReturnType<typeof useAccountingAssessments>["data"]>["assessments"];
type AssessmentItem = AssessmentList[number];

function isReformTestYear(assessment: AssessmentItem): boolean {
  return (assessment.tax === "CBS" || assessment.tax === "IBS") && assessment.period.startsWith(String(TEST_YEAR_REFORM));
}

function monthTitle(monthKey: string): string {
  const [yearText, monthText] = monthKey.split("-");
  const label = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 15)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function AssessmentRow({ assessment }: { assessment: AssessmentItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const confirmAssessment = useConfirmAssessment();
  const reopenAssessment = useReopenAssessment();
  const parsedMemo = calculationMemoSchema.safeParse(assessment.calculationMemo);
  const statusDisplay = ASSESSMENT_STATUS_DISPLAY[assessment.status];
  const termId = TAX_TERM_IDS[assessment.tax];
  const taxLabel = TAX_DISPLAY_LABELS[assessment.tax];
  const isInformative = isReformTestYear(assessment);

  function handleConfirm() {
    confirmAssessment.mutate(
      { assessmentId: assessment.id },
      {
        onSuccess: () => toast.success(`${taxLabel} confirmado. A guia virou uma conta a pagar em Despesas, com lembrete no WhatsApp.`),
        onError: (error) => toast.error(error.message || "Não foi possível confirmar."),
      },
    );
  }

  function handleReopen() {
    reopenAssessment.mutate(
      { assessmentId: assessment.id },
      {
        onSuccess: () => toast.success("Apuração reaberta. A conta a pagar gerada foi cancelada."),
        onError: (error) => toast.error(error.message || "Não foi possível reabrir."),
      },
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} asChild>
      <li className="px-3 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {taxLabel}
              {termId && <FiscalTermHint termId={termId} />}
              <Badge variant="outline" className={cn("font-medium", statusDisplay.className)}>
                {statusDisplay.label}
              </Badge>
              {isInformative && (
                <Badge variant="outline" className="border-info/30 bg-info/10 font-medium text-info dark:text-info">
                  ano-teste — informativo
                </Badge>
              )}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:flex sm:flex-wrap">
              <div>
                <dt className="inline">Base: </dt>
                <dd className="inline tabular-nums">{formatCentsBrl(assessment.baseCents)}</dd>
              </div>
              <div>
                <dt className="inline">
                  Alíquota efetiva <FiscalTermHint termId="aliquota-efetiva" />:{" "}
                </dt>
                <dd className="inline tabular-nums">{formatBps(assessment.effectiveRateBps)}</dd>
              </div>
              {assessment.creditsCents > 0 && (
                <div>
                  <dt className="inline">Créditos usados: </dt>
                  <dd className="inline tabular-nums">{formatCentsBrl(assessment.creditsCents)}</dd>
                </div>
              )}
              {assessment.dueDate && (
                <div>
                  <dt className="inline">Vence: </dt>
                  <dd className="inline tabular-nums">{formatFiscalDate(assessment.dueDate, true)}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <p className="text-lg font-bold tabular-nums">{formatCentsBrl(assessment.amountCents)}</p>
            <div className="flex flex-wrap gap-1.5">
              {assessment.status === "DRAFT" && !isInformative && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-info text-white hover:bg-info"
                  disabled={confirmAssessment.isPending}
                  onClick={handleConfirm}
                >
                  {confirmAssessment.isPending ? <OrbitaSpinner className="size-3.5 " /> : <Receipt className="size-3.5" />}
                  Confirmar e gerar guia
                </Button>
              )}
              {assessment.status === "CONFIRMED" && (
                <Button size="sm" variant="outline" className="gap-1.5" disabled={reopenAssessment.isPending} onClick={handleReopen}>
                  {reopenAssessment.isPending ? <OrbitaSpinner className="size-3.5 " /> : <RotateCcw className="size-3.5" />}
                  Reabrir
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="ghost" className="gap-1">
                  Como calculamos
                  <ChevronDown className={cn("size-3.5 transition-transform", isExpanded && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </div>
        <CollapsibleContent className="pt-3">
          {parsedMemo.success ? (
            <CalculationMemo
              title={`${taxLabel} — ${formatPeriodLabel(assessment.period)}`}
              steps={parsedMemo.data.steps}
              warnings={parsedMemo.data.warnings}
              sources={parsedMemo.data.sources}
              astroQuestion={`Explique em linguagem simples como foi calculado o ${taxLabel} de ${formatPeriodLabel(assessment.period)} e se há algo legal que eu possa fazer para pagar menos.`}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Memória de cálculo indisponível para esta apuração. Apure o mês de novo para gerá-la.</p>
          )}
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

/** Apuração mensal dos tributos e geração das guias como contas a pagar. */
export function AssessmentsSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [selectedMonth, setSelectedMonth] = useState(() => previousMonthKey());
  const selectedYear = Number(selectedMonth.slice(0, 4));
  const assessmentsQuery = useAccountingAssessments(selectedYear);
  const runAssessment = useRunAssessment();
  const quarterKey = `${selectedYear}-T${Math.ceil(Number(selectedMonth.slice(5)) / 3)}`;

  const assessmentsByPeriod = useMemo(() => {
    const groups = new Map<string, AssessmentItem[]>();
    for (const assessment of assessmentsQuery.data?.assessments ?? []) {
      const periodAssessments = groups.get(assessment.period) ?? [];
      periodAssessments.push(assessment);
      groups.set(assessment.period, periodAssessments);
    }
    return Array.from(groups.entries());
  }, [assessmentsQuery.data]);

  const hasSelectedMonth = assessmentsByPeriod.some(([period]) => period === selectedMonth);

  function handleRun() {
    runAssessment.mutate(
      { periodMonth: selectedMonth },
      {
        onSuccess: (result) =>
          toast.success(
            result.assessments.length > 0
              ? `${monthTitle(selectedMonth)} apurado. Revise os valores e confirme para gerar as guias.`
              : `Nenhum tributo a apurar em ${monthTitle(selectedMonth)} para o seu regime.`,
          ),
        onError: (error) => toast.error(error.message || "Não foi possível apurar agora."),
      },
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A apuração calcula os impostos do mês a partir das receitas lançadas no financeiro. Nada é pago sozinho: você revisa, confirma e a guia vira
        uma conta a pagar em Despesas, com lembrete e aviso no WhatsApp.
      </p>

      <Card className="py-0">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-8" aria-label="Mês anterior" onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-40 text-center">
              <p className="text-sm font-semibold">{monthTitle(selectedMonth)}</p>
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                competência <FiscalTermHint termId="competencia" />
              </p>
            </div>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Próximo mês" onClick={() => setSelectedMonth(shiftMonthKey(selectedMonth, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button className="gap-1.5 bg-info text-white hover:bg-info" disabled={runAssessment.isPending} onClick={handleRun}>
            {runAssessment.isPending && <OrbitaSpinner className="size-4 " />}
            {hasSelectedMonth ? "Apurar de novo" : "Apurar este mês"}
          </Button>
        </CardContent>
      </Card>

      {assessmentsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : assessmentsQuery.isError ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-muted-foreground">Não foi possível carregar as apurações agora.</p>
            <Button size="sm" variant="outline" onClick={() => assessmentsQuery.refetch()}>
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : assessmentsByPeriod.length === 0 ? (
        <Card className="py-0">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Receipt className="size-8 text-muted-foreground" />
            <p className="max-w-md text-sm text-muted-foreground">
              Nenhuma apuração em {selectedYear}. Escolha o mês acima e toque em “Apurar este mês” — usamos o regime do seu Perfil fiscal e as
              receitas do financeiro.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" className="bg-info text-white hover:bg-info" disabled={runAssessment.isPending} onClick={handleRun}>
                Apurar {monthTitle(selectedMonth)}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate?.("profile")}>
                Revisar perfil fiscal
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {assessmentsByPeriod.map(([period, periodAssessments]) => {
            const periodTotalCents = periodAssessments.reduce((total, assessment) => total + assessment.amountCents, 0);
            const isHighlighted = period === selectedMonth || period === quarterKey;
            return (
              <section key={period} className="space-y-2">
                <h3
                  className={cn(
                    "flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    isHighlighted && "text-info dark:text-info",
                  )}
                >
                  <span>{/-T\d$/.test(period) ? `Trimestre ${formatPeriodLabel(period)}` : monthTitle(period)}</span>
                  <span className="tabular-nums normal-case">{formatCentsBrl(periodTotalCents)}</span>
                </h3>
                <ul className={cn("divide-y rounded-lg border", isHighlighted && "border-info/40")}>
                  {periodAssessments.map((assessment) => (
                    <AssessmentRow key={assessment.id} assessment={assessment} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
