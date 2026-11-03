"use client";

import { AlertTriangle, Ban } from "lucide-react";
import type { GuardrailWarning } from "@/features/trafego/lib/wizard-guardrails";
import { cn } from "@/lib/utils";

/** Avisos de um campo do passo a passo (spec 0129, RF-6): o que piora o anúncio e o que fazer no lugar. */
export function GuardrailNotes({
  warnings,
  onRewrite,
}: {
  warnings: GuardrailWarning[];
  onRewrite?: (text: string) => void;
}) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {warnings.map((warning) => {
        const isBlocked = warning.level === "blocked";
        const Icon = isBlocked ? Ban : AlertTriangle;
        return (
          <div
            key={warning.id}
            className={cn(
              "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-snug",
              isBlocked ? "border-destructive/35 bg-destructive/10" : "border-warning/30 bg-warning/10",
            )}
          >
            <Icon className={cn("mt-0.5 size-3.5 shrink-0", isBlocked ? "text-destructive" : "text-warning")} />
            <div className="min-w-0 space-y-1 text-white/80">
              <p>{warning.message}</p>
              <p className="text-white/55">{warning.fix}</p>
              {warning.rewrite && onRewrite && (
                <button
                  type="button"
                  onClick={() => onRewrite(warning.rewrite as string)}
                  className="text-left font-medium text-info transition hover:text-info/80"
                >
                  Usar: &ldquo;{warning.rewrite}&rdquo;
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
