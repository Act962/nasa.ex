"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { openCreateCommand } from "@/features/astro-commander/lib/open-create-command";

/**
 * "Criar comando" com a marca do ASTRO, para os cabeçalhos dos apps
 * (spec 0029, RF-12). Cada app passa exemplos da própria área.
 */
export function AstroCommandButton({
  examples,
  label = "Criar comando",
  className,
  compact = false,
}: {
  examples: readonly string[];
  label?: string;
  className?: string;
  /** Só o ícone, para barras estreitas (mobile). */
  compact?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "sm"}
      onClick={() => openCreateCommand({ examples: [...examples] })}
      className={cn(
        "gap-2 border-info/40 hover:border-info/70 hover:bg-info/10",
        className,
      )}
      aria-label={compact ? label : undefined}
      title={label}
    >
      <span className="grid size-5 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0b1220]">
        <AstroMark className="size-5" />
      </span>
      {!compact && <span>{label}</span>}
    </Button>
  );
}
