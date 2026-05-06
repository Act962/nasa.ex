"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EVENT_CATEGORIES } from "../utils/categories";
import { imgSrc } from "../utils/img-src";
import {
  buildVariableHolidays,
  getHoliday,
  getMobilizationEvent,
} from "../utils/holidays";
import type { PublicEvent } from "../types";

dayjs.locale("pt-br");

interface MonthGridProps {
  events: PublicEvent[];
  onSelect: (event: PublicEvent) => void;
  selectedId?: string | null;
  onCreateForDate?: (date: Dayjs) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_VISIBLE = 4;
// Altura visual do MiniCard (h-[52px])
const CARD_HEIGHT = 52;
// Gap vertical entre mini cards (0,1 × CARD_HEIGHT ≈ 5px)
const CARD_GAP = 5;
// Padding interno da célula até a borda (0,1 × CARD_HEIGHT ≈ 5px)
const CELL_PADDING = 5;
// Altura do botão "+X mais" (aparece abaixo do último card quando há overflow)
const PLUS_MORE_HEIGHT = 25;
// Altura mínima para linhas 100% vazias (apenas números de dia)
const EMPTY_ROW_HEIGHT = 56;

function MiniCard({
  ev,
  selected,
  onSelect,
}: {
  ev: PublicEvent;
  selected: boolean;
  onSelect: (e: PublicEvent) => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const cat = ev.eventCategory
    ? EVENT_CATEGORIES.find((c) => c.value === ev.eventCategory)
    : null;

  const coverSrc = ev.coverImage && !coverFailed ? imgSrc(ev.coverImage) : null;
  // Logo da empresa (preferencial) → avatar do criador (fallback) → null.
  // Trata strings vazias e URLs inválidas como ausência de logo.
  const orgLogo =
    typeof ev.organization?.logo === "string" && ev.organization.logo.trim()
      ? ev.organization.logo
      : null;
  const userImage =
    typeof ev.user?.image === "string" && ev.user.image.trim()
      ? ev.user.image
      : null;
  const rawBrandSrc = orgLogo ?? userImage;
  const computedSrc = rawBrandSrc ? imgSrc(rawBrandSrc) : "";
  const logoSrc = computedSrc && !logoFailed ? computedSrc : null;
  const brandInitial = (
    ev.organization?.name?.[0] ??
    ev.user?.name?.[0] ??
    ev.title?.[0] ??
    "?"
  ).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(ev)}
      className={cn(
        "group relative h-[52px] w-full overflow-hidden rounded-md transition",
        selected
          ? "ring-2 ring-primary"
          : "hover:ring-2 hover:ring-primary/60",
      )}
    >
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverSrc}
          alt={ev.title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        // Sem cover: gradient com emoji da categoria como background.
        // O logo da empresa (se existir) aparece como bolinha acima do título.
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/30 via-fuchsia-500/30 to-pink-500/30 text-sm">
          {cat?.emoji ?? "✨"}
        </div>
      )}

      {/* Logo da empresa à esquerda, centralizada verticalmente no card —
          mesmo tamanho da bola da data (size-6 = 24px). */}
      <div className="absolute left-1.5 top-1/2 z-10 -translate-y-1/2">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt={ev.organization?.name ?? ev.user?.name ?? ""}
            className="size-6 rounded-full bg-white object-cover ring-1 ring-white/70 shadow"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-[10px] font-bold text-white ring-1 ring-white/70 shadow">
            {brandInitial}
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex items-center bg-gradient-to-r from-black/85 via-black/55 to-black/15 pl-[33px] pr-1.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[9px] font-bold leading-tight text-white drop-shadow">
            {ev.title}
          </div>
          <div className="truncate text-[8px] font-medium leading-tight text-white/90">
            {dayjs(ev.startDate).format("HH:mm")}
          </div>
        </div>
      </div>
    </button>
  );
}

export function MonthGrid({
  events,
  onSelect,
  selectedId,
  onCreateForDate,
}: MonthGridProps) {
  const [cursor, setCursor] = useState<Dayjs>(dayjs().startOf("month"));
  const gridRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLDivElement>(null);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PublicEvent[]>();
    for (const ev of events) {
      if (!ev.startDate) continue;
      const key = dayjs(ev.startDate).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const startOfMonth = cursor.startOf("month");
    const firstDayOfGrid = startOfMonth.subtract(startOfMonth.day(), "day");
    const days: Dayjs[] = [];
    for (let i = 0; i < 42; i++) days.push(firstDayOfGrid.add(i, "day"));
    return days;
  }, [cursor]);

  // Páscoa, Dia das Mães/Pais e Corpus Christi mudam de ano para ano —
  // calculamos para os anos visíveis na grade atual.
  const variableHolidays = useMemo(() => {
    const years = new Set(grid.map((d) => d.year()));
    return buildVariableHolidays(years);
  }, [grid]);

  // Altura de cada linha (semana) da grade:
  // - N = máximo de mini-cards visíveis em uma célula da linha (cap em MAX_VISIBLE)
  // - altura base = 2 × CELL_PADDING + N × CARD_HEIGHT + (N - 1) × CARD_GAP
  //   N=1 → 62  ·  N=2 → 119  ·  N=3 → 176  ·  N=4 → 233
  // - se algum dia da linha tem overflow (count > MAX_VISIBLE), soma CARD_GAP + PLUS_MORE_HEIGHT
  //   N=4 com overflow → 233 + 5 + 25 = 263
  // - linhas sem evento algum usam EMPTY_ROW_HEIGHT
  // - número do dia fica absolute (não consome altura)
  // Todas as 7 células da linha herdam essa altura (stretch default do CSS Grid).
  const rowHeights = useMemo(() => {
    const heights: number[] = [];
    for (let i = 0; i < grid.length; i += 7) {
      const row = grid.slice(i, i + 7);
      let maxCards = 0;
      let rowHasOverflow = false;
      let maxTopLabels = 0;
      for (const day of row) {
        const key = day.format("YYYY-MM-DD");
        const count = eventsByDay.get(key)?.length ?? 0;
        maxCards = Math.max(maxCards, Math.min(count, MAX_VISIBLE));
        if (count > MAX_VISIBLE) rowHasOverflow = true;
        const labels =
          (getHoliday(day, variableHolidays) ? 1 : 0) +
          (getMobilizationEvent(day) ? 1 : 0);
        if (labels > maxTopLabels) maxTopLabels = labels;
      }
      // 20px por label de feriado/mobilização que aparece no topo da célula.
      const topLabelExtra = maxTopLabels * 20;
      if (maxCards === 0) {
        heights.push(EMPTY_ROW_HEIGHT + topLabelExtra);
      } else {
        const base =
          2 * CELL_PADDING +
          maxCards * CARD_HEIGHT +
          (maxCards - 1) * CARD_GAP;
        const withOverflow = rowHasOverflow
          ? base + CARD_GAP + PLUS_MORE_HEIGHT
          : base;
        heights.push(withOverflow + topLabelExtra);
      }
    }
    return heights;
  }, [grid, eventsByDay, variableHolidays]);

  const today = dayjs().startOf("day");

  // Scroll so today's row is at the top; past rows scroll above and hide
  useEffect(() => {
    const isCurrentMonth = cursor.isSame(dayjs(), "month");
    if (!isCurrentMonth) return;

    const timer = setTimeout(() => {
      if (todayCellRef.current && gridRef.current) {
        const cell = todayCellRef.current;
        const container = gridRef.current;
        const cellRect = cell.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTarget =
          container.scrollTop + (cellRect.top - containerRect.top) - 4;
        container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [cursor]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xl font-bold capitalize">
          <span>{cursor.format("MMMM")}</span>
          <span className="ml-2 font-normal text-muted-foreground">
            {cursor.format("YYYY")}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCursor(dayjs().startOf("month"))}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCursor(cursor.subtract(1, "month"))}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCursor(cursor.add(1, "month"))}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-3">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/*
        CSS Grid com alturas de linha explícitas:
        — altura da linha = (N+1) × CARD_HEIGHT, onde N = máx. de mini-cards na linha (cap MAX_VISIBLE)
        — linhas vazias usam EMPTY_ROW_HEIGHT
        — TODAS as 7 células da linha herdam a mesma altura (stretch default)
          garantindo que células vazias fiquem do mesmo tamanho das com eventos
      */}
      <div
        ref={gridRef}
        className="grid flex-1 grid-cols-7 gap-1 overflow-auto px-3 pb-3"
        style={{
          gridTemplateRows: rowHeights.map((h) => `${h}px`).join(" "),
          alignContent: "start",
        }}
      >
        {grid.map((day) => {
          const dayKey = day.format("YYYY-MM-DD");
          const dayEvents = eventsByDay.get(dayKey) ?? [];
          const isOutside = !day.isSame(cursor, "month");
          const isToday = day.isSame(today, "day");
          const overflow = dayEvents.length - MAX_VISIBLE;
          const holiday = getHoliday(day, variableHolidays);
          const mobilization = getMobilizationEvent(day);
          const hasTopLabel = !!(holiday || mobilization);

          return (
            <div
              key={dayKey}
              ref={isToday ? todayCellRef : undefined}
              className={cn(
                "group/day relative overflow-hidden rounded-lg",
                isToday
                  ? "bg-primary/15 ring-1 ring-primary/40"
                  : isOutside
                    ? "bg-violet-500/8"
                    : "bg-card/60",
                onCreateForDate && "cursor-pointer hover:bg-card/80",
              )}
              style={{ padding: `${CELL_PADDING}px` }}
              onClick={(e) => {
                // Só dispara se o clique foi em área vazia da célula —
                // não em mini-cards (botões internos param a propagação).
                if (!onCreateForDate) return;
                if (e.target === e.currentTarget) {
                  onCreateForDate(day);
                }
              }}
            >
              {/* Número do dia — absolute, NÃO consome altura da cédula */}
              <div
                className={cn(
                  "pointer-events-none absolute left-[5px] top-[5px] z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-sm",
                  isToday && "bg-primary text-primary-foreground",
                  isOutside &&
                    !isToday &&
                    "bg-background/50 text-muted-foreground/50",
                  !isToday &&
                    !isOutside &&
                    "bg-background/85 text-foreground/90 backdrop-blur-sm",
                )}
              >
                {day.date()}
              </div>

              {/* Feriados / mobilizações nacionais — renderizados no topo */}
              {hasTopLabel && (
                <div className="absolute left-0 right-0 top-[28px] z-20 flex flex-col gap-0.5 px-[5px]">
                  {[holiday, mobilization].filter(Boolean).map((ev, i) => (
                    <Popover key={i}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-opacity hover:opacity-80",
                            ev!.color === "amber"
                              ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                              : "bg-indigo-400/20 text-indigo-700 dark:text-indigo-300",
                          )}
                        >
                          {ev!.label}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-72 p-0"
                        align="start"
                        side="right"
                      >
                        <div className="p-3 pb-2">
                          <p className="text-sm font-semibold leading-tight">
                            {ev!.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {ev!.description}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "mx-3 mb-2 rounded px-2 py-1.5 text-xs",
                            ev!.color === "amber"
                              ? "bg-amber-400/15 text-amber-800 dark:text-amber-300"
                              : "bg-indigo-400/15 text-indigo-800 dark:text-indigo-300",
                          )}
                        >
                          <span className="font-semibold">Impacto: </span>
                          {ev!.impact}
                        </div>
                        <div className="border-t px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Dicas de ação
                          </p>
                          <ul className="space-y-0.5">
                            {ev!.tips.map((tip, ti) => (
                              <li
                                key={ti}
                                className="flex gap-1.5 text-xs text-foreground/80"
                              >
                                <span className="mt-0.5 shrink-0 text-muted-foreground">
                                  •
                                </span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              )}

              {/* Mini cards — gap de 0,1 × CARD_HEIGHT entre eles + "+X mais" no fluxo */}
              {dayEvents.length > 0 && (
                <div
                  className="flex h-full flex-col"
                  style={{
                    gap: `${CARD_GAP}px`,
                    paddingTop:
                      holiday && mobilization
                        ? 68
                        : hasTopLabel
                          ? 48
                          : 28,
                  }}
                >
                  {dayEvents.slice(0, MAX_VISIBLE).map((ev) => (
                    <MiniCard
                      key={ev.id}
                      ev={ev}
                      selected={selectedId === ev.id}
                      onSelect={onSelect}
                    />
                  ))}

                  {overflow > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          style={{ height: `${PLUS_MORE_HEIGHT}px` }}
                          className="w-full shrink-0 rounded bg-muted/50 px-2 text-[11px] font-semibold text-foreground transition hover:bg-primary hover:text-primary-foreground"
                        >
                          +{overflow} mais
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1" align="start">
                        <div className="flex flex-col gap-0.5">
                          {dayEvents.slice(MAX_VISIBLE).map((ev) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => onSelect(ev)}
                              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition hover:bg-muted"
                            >
                              <span className="truncate font-medium">
                                {ev.title}
                              </span>
                              <span className="ml-auto shrink-0 text-muted-foreground">
                                {dayjs(ev.startDate).format("HH:mm")}
                              </span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
