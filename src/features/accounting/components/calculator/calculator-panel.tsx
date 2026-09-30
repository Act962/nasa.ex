"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalculatorContext } from "@/features/accounting/hooks/use-accounting-calculator";
import {
  CALCULATOR_GROUP_LABELS,
  CALCULATORS,
  findCalculator,
  type CalculatorGroup,
} from "@/features/accounting/lib/calculator/calculator-registry";
import { CalculatorForm } from "./calculator-form";

interface CalculatorPanelProps {
  initialCalculatorId?: string | null;
  onNavigate?: (section: string) => void;
}

const GROUP_ORDER = Object.keys(CALCULATOR_GROUP_LABELS) as CalculatorGroup[];

function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Lista de calculadoras + formulário da escolhida. Usado na seção e no botão flutuante. */
export function CalculatorPanel({ initialCalculatorId = null, onNavigate }: CalculatorPanelProps) {
  const [selectedCalculatorId, setSelectedCalculatorId] = useState<string | null>(
    initialCalculatorId && findCalculator(initialCalculatorId) ? initialCalculatorId : null,
  );
  const [searchText, setSearchText] = useState("");
  const calculatorContext = useCalculatorContext();

  const groupedCalculators = useMemo(() => {
    const normalizedSearch = normalizeForSearch(searchText.trim());
    const matching = CALCULATORS.filter(
      (calculator) =>
        !normalizedSearch || normalizeForSearch(`${calculator.title} ${calculator.description}`).includes(normalizedSearch),
    );
    return GROUP_ORDER.map((group) => ({
      group,
      label: CALCULATOR_GROUP_LABELS[group],
      calculators: matching.filter((calculator) => calculator.group === group),
    })).filter((section) => section.calculators.length > 0);
  }, [searchText]);

  const selectedCalculator = selectedCalculatorId ? findCalculator(selectedCalculatorId) : undefined;

  if (selectedCalculator) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => setSelectedCalculatorId(null)}>
          <ArrowLeft className="size-3.5" />
          Todas as calculadoras
        </Button>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-300">
            {CALCULATOR_GROUP_LABELS[selectedCalculator.group]}
          </p>
          <h3 className="text-base font-semibold leading-tight">{selectedCalculator.title}</h3>
          <p className="text-sm text-muted-foreground">{selectedCalculator.description}</p>
        </div>
        {calculatorContext.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <CalculatorForm
            key={selectedCalculator.id}
            calculator={selectedCalculator}
            context={calculatorContext.data ?? null}
            isRbt12Proportional={calculatorContext.data?.isRbt12Proportional ?? false}
            onNavigate={onNavigate}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Buscar calculadora (ex.: DAS, pró-labore, preço)"
          className="pl-9"
          aria-label="Buscar calculadora"
        />
      </div>

      {groupedCalculators.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma calculadora encontrada para “{searchText}”.
          <div className="mt-3">
            <Button type="button" size="sm" variant="outline" onClick={() => setSearchText("")}>
              Limpar busca
            </Button>
          </div>
        </div>
      )}

      {groupedCalculators.map((section) => (
        <div key={section.group} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {section.calculators.map((calculator) => (
              <button
                key={calculator.id}
                type="button"
                onClick={() => setSelectedCalculatorId(calculator.id)}
                className="group flex items-start justify-between gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/5 focus-visible:border-violet-500 focus-visible:outline-none"
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium">{calculator.title}</span>
                  <span className="block text-xs text-muted-foreground">{calculator.description}</span>
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
