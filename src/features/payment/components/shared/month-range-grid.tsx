"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Seleção por mês inteiro — o recorte natural do financeiro (competência,
// fechamento, DRE). No calendário de dias, "ver março" custa dois cliques em
// dias exatos e erra o último dia do mês com frequência.
//
// Dois cliques definem intervalo: o primeiro fixa a âncora e já aplica o mês
// sozinho, o segundo estende até o outro mês. O terceiro clique recomeça.

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

interface MonthRangeGridProps {
  from?: Date;
  to?: Date;
  onChange: (range: { from: Date; to: Date }) => void;
}

export function MonthRangeGrid({ from, to, onChange }: MonthRangeGridProps) {
  const [year, setYear] = useState(() => (from ? dayjs(from).year() : dayjs().year()));
  const [anchor, setAnchor] = useState<{ year: number; month: number } | null>(null);

  const today = dayjs();

  function isWithinSelection(monthIndex: number): boolean {
    if (!from || !to) return false;
    const monthStart = dayjs().year(year).month(monthIndex).startOf("month");
    return (
      monthStart.isAfter(dayjs(from).subtract(1, "day")) &&
      monthStart.isBefore(dayjs(to))
    );
  }

  function isSelectionEdge(monthIndex: number): boolean {
    const monthStart = dayjs().year(year).month(monthIndex).startOf("month");
    const matchesFrom = !!from && monthStart.isSame(dayjs(from).startOf("month"), "month");
    const matchesTo = !!to && monthStart.isSame(dayjs(to).startOf("month"), "month");
    return matchesFrom || matchesTo;
  }

  function handleMonthClick(monthIndex: number) {
    const clicked = { year, month: monthIndex };

    if (!anchor) {
      setAnchor(clicked);
      const start = dayjs().year(year).month(monthIndex).startOf("month");
      onChange({
        from: start.startOf("day").toDate(),
        to: start.endOf("month").endOf("day").toDate(),
      });
      return;
    }

    const anchorStart = dayjs().year(anchor.year).month(anchor.month).startOf("month");
    const clickedStart = dayjs().year(clicked.year).month(clicked.month).startOf("month");
    const [rangeStart, rangeEnd] = anchorStart.isAfter(clickedStart)
      ? [clickedStart, anchorStart]
      : [anchorStart, clickedStart];

    setAnchor(null);
    onChange({
      from: rangeStart.startOf("day").toDate(),
      to: rangeEnd.endOf("month").endOf("day").toDate(),
    });
  }

  function applyWholeYear() {
    const start = dayjs().year(year).startOf("year");
    setAnchor(null);
    onChange({
      from: start.startOf("day").toDate(),
      to: start.endOf("year").endOf("day").toDate(),
    });
  }

  return (
    <div className="w-[280px] p-3">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setYear((current) => current - 1)}
          aria-label="Ano anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <button
          type="button"
          onClick={applyWholeYear}
          className="rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-muted"
          title={`Selecionar o ano de ${year} inteiro`}
        >
          {year}
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setYear((current) => current + 1)}
          aria-label="Próximo ano"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MONTH_LABELS.map((label, monthIndex) => {
          const isEdge = isSelectionEdge(monthIndex);
          const isInside = isWithinSelection(monthIndex);
          const isCurrentMonth =
            today.year() === year && today.month() === monthIndex;
          const isAnchored =
            anchor?.year === year && anchor?.month === monthIndex;

          return (
            <button
              key={label}
              type="button"
              onClick={() => handleMonthClick(monthIndex)}
              className={cn(
                "rounded-md border py-2 text-xs font-medium transition-colors",
                isEdge
                  ? "border-primary bg-primary text-primary-foreground"
                  : isInside
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "border-transparent hover:bg-muted",
                isAnchored && !isEdge && "border-primary/60",
                isCurrentMonth && !isEdge && !isInside && "text-primary",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-center text-[10px] text-muted-foreground">
        {anchor
          ? "Clique em outro mês para formar o intervalo"
          : "Clique num mês, ou no ano para selecioná-lo inteiro"}
      </p>
    </div>
  );
}
