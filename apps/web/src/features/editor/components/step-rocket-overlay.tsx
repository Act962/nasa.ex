"use client";

/**
 * Overlay visual em nó durante Step-by-Step.
 * - "current" → foguete 🚀 pulsando, outline azul
 * - "passed"  → check verde
 * - "failed"  → X vermelho pulsante
 * - "warning" → triângulo amarelo
 *
 * Posicionado absolute em cima do node. Click no rocket abre o popover
 * de step — gerenciado pelo parent que renderiza o popover.
 */
import { RocketIcon, CheckIcon, XIcon, AlertTriangleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepNodeStatus } from "../store/step-by-step-atoms";

export function StepRocketOverlay({
  status,
  onClick,
}: {
  status: StepNodeStatus;
  onClick?: () => void;
}) {
  if (status === "idle") return null;

  if (status === "current") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Avançar este passo"
        className={cn(
          "absolute -top-3 -right-3 z-30",
          "size-6 rounded-full bg-blue-500 text-white",
          "flex items-center justify-center shadow-lg",
          "ring-4 ring-blue-300/40",
          "animate-pulse hover:scale-110 transition-transform cursor-pointer",
        )}
      >
        <RocketIcon className="size-3.5" />
        {/* CSS ring expanding outwards pra dar sensação de "pronto" */}
        <span
          className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping"
          aria-hidden
        />
      </button>
    );
  }

  if (status === "passed") {
    return (
      <div
        className={cn(
          "absolute -top-2 -right-2 z-20",
          "size-5 rounded-full bg-emerald-500 text-white",
          "flex items-center justify-center shadow-md",
        )}
        title="Passou"
      >
        <CheckIcon className="size-3 stroke-[3]" />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div
        className={cn(
          "absolute -top-2 -right-2 z-20",
          "size-5 rounded-full bg-red-500 text-white",
          "flex items-center justify-center shadow-md",
          "animate-pulse",
        )}
        title="Falhou"
      >
        <XIcon className="size-3 stroke-[3]" />
      </div>
    );
  }

  if (status === "warning") {
    return (
      <div
        className={cn(
          "absolute -top-2 -right-2 z-20",
          "size-5 rounded-full bg-amber-500 text-white",
          "flex items-center justify-center shadow-md",
        )}
        title="Passou com avisos"
      >
        <AlertTriangleIcon className="size-3 stroke-[3]" />
      </div>
    );
  }

  return null;
}
