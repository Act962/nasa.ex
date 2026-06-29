"use client";

import { useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCard } from "./event-card";
import { EVENT_CATEGORIES } from "../utils/categories";
import { imgSrc } from "../utils/img-src";
import { groupEventsByDay } from "../utils/event-days";
import type { PublicEvent } from "../types";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ptBR } from "date-fns/locale";

dayjs.locale("pt-br");

interface MobileListProps {
  events: PublicEvent[];
  onSelect: (event: PublicEvent) => void;
}

function MiniThumb({ ev }: { ev: PublicEvent }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const cat = ev.eventCategory
    ? EVENT_CATEGORIES.find((c) => c.value === ev.eventCategory)
    : null;

  const coverSrc = ev.coverImage && !coverFailed ? imgSrc(ev.coverImage) : null;
  const logoSrc =
    ev.organization?.logo && !logoFailed
      ? imgSrc(ev.organization.logo)
      : null;

  const start = ev.startDate ? dayjs(ev.startDate) : null;
  const end = ev.endDate ? dayjs(ev.endDate) : null;
  const timeLabel = start
    ? end
      ? `${start.format("HH:mm")} - ${end.format("HH:mm")}`
      : start.format("HH:mm")
    : null;

  return (
    <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md">
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverSrc}
          alt={ev.title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : logoSrc ? (
        <>
          <div className="absolute inset-0 bg-card" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt={ev.organization?.name ?? ""}
            className="absolute inset-0 h-full w-full object-contain p-1"
            onError={() => setLogoFailed(true)}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 text-sm">
          {cat?.emoji ?? "✨"}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-0.5 pb-0.5 pt-2">
        <div className="truncate text-[7px] font-semibold leading-none text-white">
          {ev.title}
        </div>
        {timeLabel && (
          <div className="text-[6px] text-white/70">{timeLabel}</div>
        )}
      </div>
    </div>
  );
}

export function MobileList({ events, onSelect }: MobileListProps) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // Map de YYYY-MM-DD → ref do `<div>` daquele dia. Permite scrollar
  // suavemente até a data selecionada no picker. Quando a data não
  // tem evento (não aparece na lista), procura o próximo dia com
  // eventos pra ter um destino útil.
  const dayRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const grouped = useMemo(() => {
    // Agrupa por dia REPETINDO eventos multi-dia em cada um dos seus
    // dias (helper `groupEventsByDay` expande startDate..endDate). Sem
    // isso, um evento de 09 a 11 só aparecia no card de "09".
    const map = groupEventsByDay(events);
    return Array.from(map.entries()).sort(([a], [b]) => (a > b ? 1 : -1));
  }, [events]);

  // Header com date picker — sempre renderizado (mesmo sem eventos)
  // pra o user conseguir mudar a data e ver outros meses.
  const today = dayjs().format("YYYY-MM-DD");
  const headerDate =
    grouped.find(([k]) => k >= today)?.[0] ?? grouped[0]?.[0] ?? today;
  const headerDay = dayjs(headerDate);

  const jumpToDate = (date: Date) => {
    const key = dayjs(date).format("YYYY-MM-DD");
    // Tenta achar o dia exato; senão, o próximo dia com evento.
    let target = grouped.find(([k]) => k === key)?.[0];
    if (!target) {
      target = grouped.find(([k]) => k >= key)?.[0];
    }
    if (!target) {
      // Sem evento depois — fica no último.
      target = grouped[grouped.length - 1]?.[0];
    }
    if (target) {
      const el = dayRefs.current.get(target);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Expande o card pra ver os eventos imediatamente
      setExpandedDay(target);
    }
    setDatePickerOpen(false);
  };

  const headerEl = (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/40 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 gap-1.5 -ml-2 text-sm font-semibold capitalize hover:bg-muted"
            title="Escolher data"
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span>{headerDay.format("MMMM")}</span>
            <span className="font-normal text-muted-foreground">
              {headerDay.format("YYYY")}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            defaultMonth={headerDay.toDate()}
            onSelect={(date) => date && jumpToDate(date)}
            // Mudou mês/ano pelos dropdowns? Já scrolla pro primeiro
            // dia daquele mês (com evento, ou o mais próximo). Sem
            // isso, usar só os dropdowns não fazia nada visível.
            onMonthChange={(m) => jumpToDate(m)}
            captionLayout="dropdown"
            startMonth={new Date(2020, 0)}
            endMonth={new Date(2030, 11)}
            locale={ptBR}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => jumpToDate(new Date())}
      >
        Hoje
      </Button>
    </div>
  );

  if (!grouped.length) {
    return (
      <div className="flex flex-col">
        {headerEl}
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          Nenhum evento encontrado com esses filtros.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/40">
      {headerEl}
      {grouped.map(([dayKey, dayEvents]) => {
        const d = dayjs(dayKey);
        const isExpanded = expandedDay === dayKey;

        return (
          <div
            key={dayKey}
            ref={(el) => {
              // Ref por dia pra scrollIntoView do date picker.
              if (el) dayRefs.current.set(dayKey, el);
              else dayRefs.current.delete(dayKey);
            }}
            // Compensa o sticky header pra o dia escolhido não ficar
            // escondido atrás dele após o scroll.
            style={{ scrollMarginTop: "60px" }}
          >
            <button
              type="button"
              onClick={() => setExpandedDay(isExpanded ? null : dayKey)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
            >
              {/* Day number */}
              <div className="w-9 shrink-0 text-center text-3xl font-bold leading-none">
                {d.format("DD")}
              </div>

              {/* Day name + month */}
              <div className="w-24 shrink-0">
                <div className="text-sm font-semibold capitalize">
                  {d.format("dddd")}
                </div>
                <div className="text-xs capitalize text-muted-foreground">
                  {d.format("MMMM")}
                </div>
              </div>

              {/* Mini thumbnails */}
              <div className="flex flex-1 gap-1 overflow-hidden">
                {dayEvents.slice(0, 3).map((ev) => (
                  <MiniThumb key={ev.id} ev={ev} />
                ))}
                {dayEvents.length > 3 && (
                  <div className="flex h-[52px] w-[52px] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                    +{dayEvents.length - 3}
                  </div>
                )}
              </div>

              {/* Chevron */}
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>

            {/* Expanded grid */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
              )}
            >
              <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-1 sm:grid-cols-3">
                {dayEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} onClick={() => onSelect(ev)} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
