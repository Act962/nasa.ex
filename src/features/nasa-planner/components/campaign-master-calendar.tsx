"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeftIcon, ChevronRightIcon, CalendarIcon, FilterIcon,
  RocketIcon, ClockIcon, CheckSquareIcon, BuildingIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCampaignCalendar, useCampaigns } from "../hooks/use-campaign-planner";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EVENT_TYPE_LABELS: Record<string, string> = {
  TRAINING: "📚 Treinamento",
  STRATEGIC_MEETING: "🤝 Reunião",
  KICKOFF: "🚀 Kickoff",
  REVIEW: "📊 Review",
  PRESENTATION: "🎤 Apresentação",
  DEADLINE: "⏰ Prazo",
};

const PALETTE = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#14b8a6", "#a855f7"];

export function CampaignMasterCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());

  const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
  const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  const { calendar, isLoading } = useCampaignCalendar({ startDate, endDate });
  const { campaigns } = useCampaigns();

  const campaignColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    campaigns.forEach((c: any, i: number) => {
      map[c.id] = c.color ?? PALETTE[i % PALETTE.length];
    });
    return map;
  }, [campaigns]);

  const toggleCampaign = (id: string) => {
    setSelectedCampaigns((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  const filteredEvents = useMemo(() => {
    if (!calendar) return [];
    return (calendar.events ?? []).filter((e: any) => selectedCampaigns.size === 0 || selectedCampaigns.has(e.campaignPlannerId));
  }, [calendar, selectedCampaigns]);

  const filteredTasks = useMemo(() => {
    if (!calendar) return [];
    return (calendar.tasks ?? []).filter((t: any) => selectedCampaigns.size === 0 || selectedCampaigns.has(t.campaignPlannerId));
  }, [calendar, selectedCampaigns]);

  // Build day grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  const getEventsForDay = (day: number) => {
    return filteredEvents.filter((e: any) => {
      const d = new Date(e.scheduledAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const getTasksForDay = (day: number) => {
    return filteredTasks.filter((t: any) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
            <CalendarIcon className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Calendário Mestre</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada de todas as campanhas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FilterIcon className="size-3.5" />
                Filtrar
                {selectedCampaigns.size > 0 && <Badge className="h-4 px-1 text-xs">{selectedCampaigns.size}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <p className="text-sm font-medium mb-3">Filtrar por campanha</p>
              {campaigns.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma campanha</p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((c: any, i: number) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`filter-${c.id}`}
                        checked={selectedCampaigns.has(c.id)}
                        onCheckedChange={() => toggleCampaign(c.id)}
                      />
                      <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color ?? PALETTE[i % PALETTE.length] }} />
                      <Label htmlFor={`filter-${c.id}`} className="text-sm cursor-pointer truncate">{c.title}</Label>
                    </div>
                  ))}
                  {selectedCampaigns.size > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setSelectedCampaigns(new Set())}>
                      Limpar filtros
                    </Button>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Month navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={prevMonth}><ChevronLeftIcon className="size-4" /></Button>
            <span className="text-sm font-medium min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
            <Button variant="ghost" size="icon" className="size-8" onClick={nextMonth}><ChevronRightIcon className="size-4" /></Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      {campaigns.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-2 border-b flex-wrap">
          {campaigns.map((c: any, i: number) => (
            <div key={c.id} className="flex items-center gap-1.5 text-xs">
              <div className="size-2.5 rounded-full" style={{ backgroundColor: c.color ?? PALETTE[i % PALETTE.length] }} />
              <span className="text-muted-foreground">{c.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array(35).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : (
          <>
            {/* Day names */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Weeks */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                const isToday = day && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const dayEvents = day ? getEventsForDay(day) : [];
                const dayTasks = day ? getTasksForDay(day) : [];

                return (
                  <div
                    key={idx}
                    className={cn("min-h-24 border rounded-lg p-1.5 transition-colors", day ? "hover:bg-muted/30" : "opacity-0 pointer-events-none", isToday && "border-violet-400 bg-violet-50 dark:bg-violet-950/20")}
                  >
                    {day && (
                      <>
                        <div className={cn("text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full", isToday ? "bg-violet-600 text-white" : "text-muted-foreground")}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map((ev: any) => (
                            <div
                              key={ev.id}
                              className="text-xs px-1 py-0.5 rounded truncate text-white font-medium"
                              style={{ backgroundColor: campaignColorMap[ev.campaignPlannerId] ?? "#7c3aed" }}
                              title={`${EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}: ${ev.title}`}
                            >
                              {ev.title}
                            </div>
                          ))}
                          {dayTasks.slice(0, 2).map((task: any) => (
                            <div
                              key={task.id}
                              className="text-xs px-1 py-0.5 rounded truncate border font-medium"
                              style={{ borderColor: campaignColorMap[task.campaignPlannerId] ?? "#7c3aed", color: campaignColorMap[task.campaignPlannerId] ?? "#7c3aed" }}
                              title={`Tarefa: ${task.title}`}
                            >
                              ✓ {task.title}
                            </div>
                          ))}
                          {(dayEvents.length + dayTasks.length) > 4 && (
                            <div className="text-xs text-muted-foreground px-1">+{(dayEvents.length + dayTasks.length) - 4} mais</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      <div className="border-t px-6 py-3 flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><RocketIcon className="size-3.5" /> {filteredEvents.length} eventos no mês</div>
        <div className="flex items-center gap-1.5"><CheckSquareIcon className="size-3.5" /> {filteredTasks.length} tarefas com prazo</div>
        <div className="flex items-center gap-1.5"><BuildingIcon className="size-3.5" /> {calendar?.campaigns?.length ?? 0} campanhas ativas</div>
      </div>
    </div>
  );
}
