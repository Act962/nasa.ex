"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useSetPlannerWeekdayTheme } from "../../hooks/use-planner-weekly-script";
import { WEEKDAY_LABELS } from "./planner-v2-utils";

/** Tema fixo do dia da semana (spec 0067, RF-1): etiqueta acima do dia, editável no clique. */
export function WeekdayThemeChip({ organizationId, weekday, theme, canEdit, isFirst }: { organizationId: string; weekday: number; theme: string | null; canEdit: boolean; isFirst?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftTheme, setDraftTheme] = useState(theme ?? "");
  const setTheme = useSetPlannerWeekdayTheme();
  const save = () => setTheme.mutate({ organizationId, weekday, theme: draftTheme.trim() }, { onSuccess: () => setIsOpen(false) });

  if (!canEdit && !theme) return <span className="block h-5" />;
  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) setDraftTheme(theme ?? "");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!canEdit}
          title={theme ?? undefined}
          data-guide={isFirst ? GUIDE_ANCHORS.plannerWeekdayTheme.id : undefined}
          className={cn(
            "mb-1 block h-5 w-full truncate rounded-full px-2 text-[10.5px] leading-5",
            theme ? "bg-info/15 font-semibold text-info" : "border border-dashed border-line text-muted-foreground hover:text-foreground",
          )}
        >
          {theme ?? "+ tema do dia"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64 rounded-[18px] p-3">
        <p className="text-xs font-semibold">Tema de toda {WEEKDAY_LABELS[weekday].toLowerCase()}</p>
        <p className="mb-2 text-[11px] text-muted-foreground">Ex.: Dor + identificação + perda. Vale para todas as semanas deste cliente.</p>
        <input
          autoFocus
          value={draftTheme}
          maxLength={80}
          onChange={(event) => setDraftTheme(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && save()}
          className="w-full rounded-full bg-panel px-3 py-1.5 text-sm outline-none"
        />
        <div className="mt-2 flex justify-end gap-1.5">
          {theme && (
            <button type="button" onClick={() => setTheme.mutate({ organizationId, weekday, theme: "" }, { onSuccess: () => setIsOpen(false) })} className="rounded-full bg-panel px-3 py-1 text-xs">
              Remover
            </button>
          )}
          <button type="button" disabled={setTheme.isPending} onClick={save} className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background disabled:opacity-40">
            Salvar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
