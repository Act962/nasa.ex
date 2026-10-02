import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";

/**
 * Step de thinking — pode ser:
 *  - string: passo padrão ("Executando search_lead…")
 *  - { label, mode: "rocket" }: passo de exploração com o carregamento da ÓRBITA
 *    ("Explorando no universo NASA" + carregamento da ÓRBITA)
 *
 * Modo "rocket" é usado quando o orchestrator delega pra um sub-agente
 * (route_to_*). Cada agente pode ter sua própria label amigável.
 */
export type ThinkingStep =
  | string
  | { label: string; mode: "rocket" };

export function ThinkingDisplay({ steps }: { steps: ThinkingStep[] }) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    if (visibleCount >= steps.length) return;
    const t = setTimeout(() => setVisibleCount((c) => c + 1), 420);
    return () => clearTimeout(t);
  }, [visibleCount, steps.length]);

  // Step ATIVO (mais recente visível) — decide o modo visual do bloco.
  const activeStep = steps[Math.max(0, visibleCount - 1)];
  const isRocketMode =
    typeof activeStep === "object" && activeStep.mode === "rocket";

  const visibleLabels = steps
    .slice(0, visibleCount)
    .map((s) => (typeof s === "string" ? s : s.label));

  // No modo rocket, renderiza compacto: foguete + texto, sem avatar Astro
  // e sem fundo/borda da bolha — só tipografia.
  if (isRocketMode) {
    return (
      <div className="flex items-center gap-2 py-1 px-1 text-xs text-muted-foreground">
        <OrbitaSpinner className="size-5" />
        <span className="truncate">{visibleLabels.join(" · ")}</span>
        {visibleCount < steps.length && (
          <span className="shrink-0 text-muted-foreground">
            {visibleCount}/{steps.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-9 h-9 rounded-full bg-linear-to-br from-info to-info flex items-center justify-center shrink-0 shadow-lg shadow-info/40">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 bg-card/60 border border-line/80 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <OrbitaSpinner className="size-4" />
          <span className="truncate">{visibleLabels.join(" · ")}</span>
          {visibleCount < steps.length && (
            <span className="shrink-0 text-muted-foreground">
              {visibleCount}/{steps.length} resultados
            </span>
          )}
          {visibleCount >= steps.length && (
            <span className="shrink-0 text-info">✓ concluído</span>
          )}
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-info animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
