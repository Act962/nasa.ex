"use client";

import { Copy, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openAstroWidget } from "@/features/astro/lib/open-astro-widget";
import { FiscalTermHint } from "./fiscal-term-hint";

export interface CalculationMemoStep {
  label: string;
  formula?: string;
  value: string;
  legalSource?: string;
  termId?: string;
}

interface CalculationMemoProps {
  title: string;
  steps: CalculationMemoStep[];
  warnings?: Array<{ code: string; message: string }>;
  sources?: string[];
  /** Pergunta enviada ao ASTRO no "Explicar com ASTRO". */
  astroQuestion?: string;
}

function buildPlainText(title: string, steps: CalculationMemoStep[]): string {
  return [title, ...steps.map((step) => `${step.label}: ${step.value}${step.formula ? ` (${step.formula})` : ""}`)].join("\n");
}

/** Memória de cálculo passo a passo, igual na calculadora e nas apurações. */
export function CalculationMemo({ title, steps, warnings = [], sources = [], astroQuestion }: CalculationMemoProps) {
  const plainText = buildPlainText(title, steps);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(plainText);
      toast.success("Memória de cálculo copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  function handleExplain() {
    openAstroWidget(
      `${astroQuestion ?? "Explique este cálculo em linguagem simples e diga se há algo que eu possa fazer para pagar menos imposto legalmente."}\n\n${plainText}`,
    );
  }

  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((warning) => (
            <li
              key={warning.code}
              className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning dark:text-warning"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {warning.message}
            </li>
          ))}
        </ul>
      )}

      <ol className="divide-y rounded-lg border">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {step.label}
                {step.termId && <FiscalTermHint termId={step.termId} />}
              </p>
              {step.formula && <p className="text-xs text-muted-foreground break-words">{step.formula}</p>}
              {step.legalSource && <p className="text-[11px] text-muted-foreground/80">{step.legalSource}</p>}
            </div>
            <p className="shrink-0 font-mono text-sm font-semibold tabular-nums sm:text-right">{step.value}</p>
          </li>
        ))}
      </ol>

      {sources.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Tabelas usadas</summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={handleExplain}>
          <Sparkles className="size-3.5" />
          Explicar com ASTRO
        </Button>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={handleCopy}>
          <Copy className="size-3.5" />
          Copiar
        </Button>
      </div>
    </div>
  );
}
