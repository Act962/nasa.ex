"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Moldura de toda tela do wizard: título, subtítulo, conteúdo e a dupla
 * Voltar/Continuar. Centraliza o espaçamento para as telas não divergirem.
 */
export function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Continuar",
  canGoNext,
  isBusy,
  backDisabled,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  canGoNext: boolean;
  isBusy?: boolean;
  backDisabled?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300/80">
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "text-xl font-bold text-white sm:text-2xl",
          eyebrow && "mt-1.5",
        )}
      >
        {title}
      </h2>
      {subtitle && <p className="mt-1.5 text-sm text-white/45">{subtitle}</p>}

      <div className="mt-6">{children}</div>

      <div className="mt-7 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled || isBusy}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/50 transition hover:text-white disabled:opacity-40"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isBusy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isBusy && <Loader2 className="size-4 animate-spin" />}
          {nextLabel}
          {!isBusy && <ArrowRight className="size-4" />}
        </button>
      </div>
    </div>
  );
}
