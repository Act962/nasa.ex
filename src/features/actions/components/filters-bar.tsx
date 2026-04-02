"use client";

import {
  UserIcon,
  TagIcon,
  CalendarIcon,
  ArrowUpDownIcon,
  XIcon,
  ArchiveIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { pt } from "react-day-picker/locale";
import dayjs from "dayjs";
import {
  useListTags,
  useWorkspaceMembers,
} from "@/features/workspace/hooks/use-workspace";
import { useActionFilters } from "../hooks/use-action-filters";

const DATE_INTERVALS = [
  { label: "Hoje",         from: () => dayjs().toDate(),                  to: () => dayjs().toDate() },
  { label: "Semana",       from: () => dayjs().day(0).toDate(),           to: () => dayjs().day(6).toDate() },
  { label: "Mês",          from: () => dayjs().startOf("month").toDate(), to: () => dayjs().endOf("month").toDate() },
  { label: "Ano",          from: () => dayjs().startOf("year").toDate(),  to: () => dayjs().endOf("year").toDate() },
  { label: "Últimos 7d",   from: () => dayjs().subtract(6, "day").toDate(), to: () => dayjs().toDate() },
  { label: "Últimos 30d",  from: () => dayjs().subtract(29, "day").toDate(), to: () => dayjs().toDate() },
];

const SORT_OPTIONS = [
  { value: "createdAt", label: "Data de criação" },
  { value: "dueDate", label: "Prazo" },
  { value: "priority", label: "Prioridade" },
  { value: "title", label: "Título" },
] as const;

interface Props {
  workspaceId: string;
}

export function FiltersBar({ workspaceId }: Props) {
  const { tags } = useListTags(workspaceId);
  const { members } = useWorkspaceMembers(workspaceId);
  const { filters, setFilters, activeCount, clearFilters } = useActionFilters();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(
    undefined,
  );

  const handleCalendarOpen = (open: boolean) => {
    if (open) {
      setPendingRange({
        from: filters.dueDateFrom ?? undefined,
        to: filters.dueDateTo ?? undefined,
      });
    }
    setCalendarOpen(open);
  };

  const handleApplyDate = () => {
    setFilters({
      ...filters,
      dueDateFrom: pendingRange?.from
        ? dayjs(pendingRange.from).startOf("day").toDate()
        : null,
      dueDateTo: pendingRange?.to
        ? dayjs(pendingRange.to).endOf("day").toDate()
        : null,
    });
    setCalendarOpen(false);
  };

  const handleResetDate = () => {
    setPendingRange(undefined);
    setFilters({ ...filters, dueDateFrom: null, dueDateTo: null });
    setCalendarOpen(false);
  };

  const toggleParticipant = (id: string) => {
    const ids = filters.participantIds.includes(id)
      ? filters.participantIds.filter((x) => x !== id)
      : [...filters.participantIds, id];
    setFilters({ ...filters, participantIds: ids });
  };

  const toggleTag = (id: string) => {
    const ids = filters.tagIds.includes(id)
      ? filters.tagIds.filter((x) => x !== id)
      : [...filters.tagIds, id];
    setFilters({ ...filters, tagIds: ids });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Participants filter */}
      {members.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={
                filters.participantIds.length > 0 ? "secondary" : "outline"
              }
              size="sm"
              className="h-7 gap-1.5 text-xs"
            >
              <UserIcon className="size-3" />
              Participantes
              {filters.participantIds.length > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px]">
                  {filters.participantIds.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1.5" align="start">
            <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">
              Filtrar por participante
            </p>
            <div className="space-y-0.5">
              {members.map((m: any) => {
                const active = filters.participantIds.includes(m.user.id);
                return (
                  <button
                    key={m.user.id}
                    onClick={() => toggleParticipant(m.user.id)}
                    className="flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <Avatar className="size-5">
                      <AvatarImage src={m.user.image || ""} />
                      <AvatarFallback className="text-[9px]">
                        {m.user.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-xs text-left truncate">
                      {m.user.name}
                    </span>
                    {active && (
                      <span className="text-primary text-xs font-bold">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Tags filter */}
      {tags.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filters.tagIds.length > 0 ? "secondary" : "outline"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
            >
              <TagIcon className="size-3" />
              Etiquetas
              {filters.tagIds.length > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px]">
                  {filters.tagIds.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1.5" align="start">
            <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">
              Filtrar por etiqueta
            </p>
            <div className="space-y-0.5">
              {tags.map((tag: any) => {
                const active = filters.tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-muted transition-colors"
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-xs text-left">{tag.name}</span>
                    {active && (
                      <span className="text-primary text-xs font-bold">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Date range filter */}
      <Popover open={calendarOpen} onOpenChange={handleCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={
              filters.dueDateFrom || filters.dueDateTo ? "secondary" : "outline"
            }
            size="sm"
            className="h-7 gap-1.5 text-xs"
          >
            <CalendarIcon className="size-3" />
            Calendário
            {(filters.dueDateFrom || filters.dueDateTo) && (
              <span className="text-muted-foreground">
                {`${filters.dueDateFrom ? dayjs(filters.dueDateFrom).format("DD/MM") : "..."} – ${filters.dueDateTo ? dayjs(filters.dueDateTo).format("DD/MM") : "..."}`}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="p-0 border rounded-lg shadow-sm w-fit flex overflow-hidden"
        >
          <div className="hidden md:flex flex-col gap-0.5 border-r border-border w-36 px-2 py-2">
            {DATE_INTERVALS.map((interval) => (
              <Button
                key={interval.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() =>
                  setPendingRange({ from: interval.from(), to: interval.to() })
                }
              >
                {interval.label}
              </Button>
            ))}
          </div>
          <div className="bg-background">
            <Calendar
              mode="range"
              defaultMonth={pendingRange?.from}
              selected={pendingRange}
              onSelect={setPendingRange}
              numberOfMonths={2}
              locale={pt}
              timeZone="America/Sao_Paulo"
              className="border-none"
            />
            <div className="flex justify-end gap-2 p-2 border-t">
              {(filters.dueDateFrom || filters.dueDateTo) && (
                <Button variant="outline" size="sm" onClick={handleResetDate}>
                  Resetar
                </Button>
              )}
              <Button size="sm" onClick={handleApplyDate}>
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={
              filters.sortBy !== "createdAt" || filters.sortOrder !== "desc"
                ? "secondary"
                : "outline"
            }
            size="sm"
            className="h-7 gap-1.5 text-xs"
          >
            <ArrowUpDownIcon className="size-3" />
            Ordenar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3 space-y-3" align="start">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Ordenar por
            </p>
            <Select
              value={filters.sortBy}
              onValueChange={(v) =>
                setFilters({ ...filters, sortBy: v as typeof filters.sortBy })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-xs"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Ordem</p>
            <div className="flex gap-2">
              {(["asc", "desc"] as const).map((o) => (
                <Button
                  key={o}
                  variant={filters.sortOrder === o ? "default" : "outline"}
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={() => setFilters({ ...filters, sortOrder: o })}
                >
                  {o === "asc" ? "Crescente" : "Decrescente"}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Archived filter */}
      <Button
        variant={filters.showArchived ? "secondary" : "outline"}
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setFilters({ ...filters, showArchived: !filters.showArchived })}
      >
        <ArchiveIcon className="size-3" />
        Arquivados
      </Button>

      {/* Clear all */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
          onClick={clearFilters}
        >
          <XIcon className="size-3" />
          Limpar ({activeCount})
        </Button>
      )}
    </div>
  );
}
