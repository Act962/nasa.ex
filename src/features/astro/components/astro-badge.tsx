"use client";

import { cn } from "@/lib/utils";
import { AstroMark } from "@/features/astro/components/astro-mark";

/**
 * Selo "por ASTRO" para tudo que a IA da plataforma gera (spec 0029, RF-14).
 * Uma marca só: o usuário aprende que a inteligência do ÓRBITA é o ASTRO.
 */
export function AstroBadge({
  label = "por ASTRO",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-300",
        className,
      )}
    >
      <span className="grid size-3.5 place-items-center overflow-hidden rounded-full bg-[#0b1220]">
        <AstroMark className="size-3.5" />
      </span>
      {label}
    </span>
  );
}
