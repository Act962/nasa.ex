"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Calculator, ExternalLink, Send, TriangleAlert } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRunCalculator } from "@/features/accounting/hooks/use-accounting-calculator";
import type {
  CalculatorContextDefaults,
  CalculatorDefinition,
  CalculatorValues,
} from "@/features/accounting/lib/calculator/calculator-registry";
import { OFFICIAL_LINKS } from "@/features/accounting/lib/glossary/terms";
import { formatBps, formatCentsBrl } from "@/features/accounting/lib/format";
import { CalculationMemo } from "../shared/calculation-memo";
import {
  CalculatorFieldInput,
  buildInitialDraft,
  isFieldPrefilled,
  toSubmitValue,
  type CalculatorDrafts,
  type CalculatorFieldDraft,
} from "./calculator-field-input";
import { dispatchApplyPrice } from "./apply-price-event";

const AUTO_RECALC_DELAY_MS = 400;
const ASSESSMENT_CALCULATOR_IDS = new Set(["das_simples", "presumido_trimestre", "presumido_mensal", "das_mei"]);

interface CalculatorFormProps {
  calculator: CalculatorDefinition;
  context: CalculatorContextDefaults | null;
  isRbt12Proportional: boolean;
  onNavigate?: (section: string) => void;
}

function buildValues(calculator: CalculatorDefinition, drafts: CalculatorDrafts): CalculatorValues {
  return Object.fromEntries(calculator.fields.map((field) => [field.name, toSubmitValue(field, drafts[field.name])]));
}

function readPriceCents(output: unknown): number | null {
  if (typeof output !== "object" || output === null || !("priceCents" in output)) return null;
  return typeof output.priceCents === "number" ? output.priceCents : null;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Não foi possível calcular agora. Tente de novo.";
}

/** Formulário de uma calculadora do registro + memória de cálculo do resultado. */
export function CalculatorForm({ calculator, context, isRbt12Proportional, onNavigate }: CalculatorFormProps) {
  const [drafts, setDrafts] = useState<CalculatorDrafts>(() =>
    Object.fromEntries(calculator.fields.map((field) => [field.name, buildInitialDraft(field, context)])),
  );
  const [editedFieldNames, setEditedFieldNames] = useState<Set<string>>(() => new Set());
  const [submittedValues, setSubmittedValues] = useState<CalculatorValues | null>(null);
  const lastRunSerialized = useRef<string | null>(null);
  const { mutate, data: result, isPending, error } = useRunCalculator();

  const values = useMemo(() => buildValues(calculator, drafts), [calculator, drafts]);
  const serializedValues = JSON.stringify(values);
  const hasCalculated = submittedValues !== null;
  const usesRbt12 = calculator.fields.some((field) => field.prefillFrom === "rbt12Cents");

  const runValues = useCallback(
    (valuesToRun: CalculatorValues) => {
      lastRunSerialized.current = JSON.stringify(valuesToRun);
      setSubmittedValues(valuesToRun);
      mutate({ calculatorId: calculator.id, values: valuesToRun });
    },
    [calculator.id, mutate],
  );

  // Depois do primeiro "Calcular", o resultado acompanha os campos sozinho.
  useEffect(() => {
    if (!hasCalculated || serializedValues === lastRunSerialized.current) return;
    const timer = setTimeout(() => runValues(values), AUTO_RECALC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasCalculated, serializedValues, values, runValues]);

  function handleFieldChange(fieldName: string, draft: CalculatorFieldDraft) {
    setDrafts((current) => ({ ...current, [fieldName]: draft }));
    setEditedFieldNames((current) => (current.has(fieldName) ? current : new Set(current).add(fieldName)));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    runValues(values);
  }

  function handleApplyPrice(priceCents: number) {
    const taxRateBps = typeof submittedValues?.taxRateBps === "number" ? submittedValues.taxRateBps : 0;
    dispatchApplyPrice({ priceCents, taxRateBps });
    toast.success("Preço enviado para Produtos & Preços");
    onNavigate?.("pricing");
  }

  const markupPriceCents = calculator.id === "markup" && result ? readPriceCents(result.output) : null;

  return (
    <div className="space-y-5">
      {usesRbt12 && isRbt12Proportional && (
        <Alert className="border-warning/30 bg-warning/10">
          <TriangleAlert className="size-4 text-warning" />
          <AlertDescription className="text-xs text-warning dark:text-warning">
            Sua empresa tem menos de 12 meses de faturamento, então o RBT12 foi proporcionalizado (média dos meses × 12),
            como manda a LC 123/2006.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {calculator.fields.map((field) => (
            <CalculatorFieldInput
              key={field.name}
              field={field}
              inputId={`${calculator.id}-${field.name}`}
              draft={drafts[field.name]}
              isPrefilled={isFieldPrefilled(field, context) && !editedFieldNames.has(field.name)}
              onChange={(draft) => handleFieldChange(field.name, draft)}
            />
          ))}
        </div>
        <Button type="submit" className="w-full gap-1.5 bg-info text-white hover:bg-info sm:w-auto" disabled={isPending}>
          {isPending ? <OrbitaSpinner className="size-4 " /> : <Calculator className="size-4" />}
          Calcular
        </Button>
      </form>

      {error && !isPending && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {toErrorMessage(error)}
        </p>
      )}

      {result && (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
          <p className="text-sm font-semibold">Resultado</p>
          <CalculationMemo
            title={calculator.title}
            steps={result.steps}
            warnings={result.warnings}
            sources={result.sources}
            astroQuestion={`Explique em linguagem simples o resultado da calculadora "${calculator.title}" e diga se há algo que eu possa fazer para pagar menos imposto legalmente.`}
          />

          {markupPriceCents !== null && markupPriceCents > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-info/30 bg-info/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Preço sugerido: <span className="font-semibold tabular-nums">{formatCentsBrl(markupPriceCents)}</span>
                {typeof submittedValues?.taxRateBps === "number" && (
                  <span className="text-muted-foreground"> · impostos {formatBps(submittedValues.taxRateBps)}</span>
                )}
              </p>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => handleApplyPrice(markupPriceCents)}>
                <Send className="size-3.5" />
                Aplicar no produto / simulação do Forge
              </Button>
            </div>
          )}

          {ASSESSMENT_CALCULATOR_IDS.has(calculator.id) && onNavigate && (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate("assessments")}>
              Ir para apurações
              <ArrowRight className="size-3.5" />
            </Button>
          )}

          {calculator.id === "guia_atraso" && (
            <p className="text-xs text-muted-foreground">
              A Selic acumulada de cada mês está na tabela oficial da Receita:{" "}
              <a
                href={OFFICIAL_LINKS.selicReceita.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-info hover:underline"
              >
                {OFFICIAL_LINKS.selicReceita.label}
                <ExternalLink className="size-3" />
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
