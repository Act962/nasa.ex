"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  key: string;
  label: string;
}

/**
 * Trilha numerada do wizard. As verificações de canal (conta do Instagram,
 * número da API) são sub-telas do passo 1 — por isso a trilha continua com
 * seis marcos, sem inflar conforme o canal escolhido.
 */
export function WizardStepper({
  steps,
  currentIndex,
}: {
  steps: readonly WizardStep[];
  currentIndex: number;
}) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 sm:gap-x-2">
      {steps.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={cn(
                "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition",
                isCurrent && "bg-violet-500 text-white",
                isDone && "bg-violet-500/20 text-violet-300",
                !isDone && !isCurrent && "bg-white/[0.07] text-white/35",
              )}
            >
              {isDone ? <Check className="size-3" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-[11px] sm:text-xs",
                isCurrent ? "font-semibold text-white" : "text-white/35",
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <span aria-hidden className="hidden h-px w-4 bg-white/10 sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
