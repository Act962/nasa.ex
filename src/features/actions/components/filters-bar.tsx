"use client";

import { useState } from "react";
import {
  FilterIcon,
  UserIcon,
  TagIcon,
  CalendarIcon,
  ArrowUpDownIcon,
  XIcon,
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useListTags, useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace";

export interface FiltersState {
  participantIds: string[];
  tagIds: string[];
  dueDateFrom: Date | null;
  dueDateTo: Date | null;
  sortBy: "createdAt" | "dueDate" | "priority" | "title";
  sortOrder: "asc" | "desc";
}

const SORT_OPTIONS = [
  { value: "createdAt", label: "Data de criação" },
  { value: "dueDate", label: "Prazo" },
  { value: "priority", label: "Prioridade" },
  { value: "title", label: "Título" },
] as const;

interface Props {
  workspaceId: string;
  filters: FiltersState;
  onFiltersChange: (filters: FiltersState) => void;
}

export const DEFAULT_FILTERS: FiltersState = {
  participantIds: [],
  tagIds: [],
  dueDateFrom: null,
  dueDateTo: null,
  sortBy: "createdAt",
  sortOrder: "desc",
};

export function FiltersBar({ workspaceId, filters, onFiltersChange }: Props) {
  const { tags } = useListTags(workspaceId);
  const { members } = useWorkspaceMembers(workspaceId);

  const activeCount = [
    filters.participantIds.length > 0,
    filters.tagIds.length > 0,
    filters.dueDateFrom || filters.dueDateTo,
    filters.sortBy !== "createdAt" || filters.sortOrder !== "desc",
  ].filter(Boolean).length;

  const clearAll = () => onFiltersChange(DEFAULT_FILTERS);

  const toggleParticipant = (id: string) => {
    const ids = filters.participantIds.includes(id)
      ? filters.participantIds.filter((x) => x !== id)
      : [...filters.participantIds, id];
    onFiltersChange({ ...filters, participantIds: ids });
  };

  const toggleTag = (id: string) => {
    const ids = filters.tagIds.includes(id)
      ? filters.tagIds.filter((x) => x !== id)
      : [...filters.tagIds, id];
    onFiltersChange({ ...filters, tagIds: ids });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Participants filter */}
      {members.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filters.participantIds.length > 0 ? "secondary" : "outline"}
              size="sm"
              className="h-7 gap-1.5 text-xs"
            >
              <UserIcon className="size-3" />
              Participantes
              {filters.participantIds.length > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px]">{filters.participantIds.length}</Badge>
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
                      <AvatarFallback className="text-[9px]">{m.user.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-xs text-left truncate">{m.user.name}</span>
                    {active && <span className="text-primary text-xs font-bold">✓</span>}
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
                <Badge className="h-4 min-w-4 px-1 text-[10px]">{filters.tagIds.length}</Badge>
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
                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="flex-1 text-xs text-left">{tag.name}</span>
                    {active && <span className="text-primary text-xs font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Date range filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={(filters.dueDateFrom || filters.dueDateTo) ? "secondary" : "outline"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
          >
            <CalendarIcon className="size-3" />
            {filters.dueDateFrom || filters.dueDateTo
              ? `${filters.dueDateFrom ? format(filters.dueDateFrom, "dd/MM", { locale: ptBR }) : "..."} – ${filters.dueDateTo ? format(filters.dueDateTo, "dd/MM", { locale: ptBR }) : "..."}`
              : "Calendário"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b">
            <p className="text-xs font-medium">Período de prazo</p>
          </div>
          <Calendar
            mode="range"
            selected={{ from: filters.dueDateFrom ?? undefined, to: filters.dueDateTo ?? undefined }}
            onSelect={(range) =>
              onFiltersChange({
                ...filters,
                dueDateFrom: range?.from ?? null,
                dueDateTo: range?.to ?? null,
              })
            }
            locale={ptBR}
          />
          {(filters.dueDateFrom || filters.dueDateTo) && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs w-full"
                onClick={() => onFiltersChange({ ...filters, dueDateFrom: null, dueDateTo: null })}
              >
                Limpar datas
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={(filters.sortBy !== "createdAt" || filters.sortOrder !== "desc") ? "secondary" : "outline"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
          >
            <ArrowUpDownIcon className="size-3" />
            Ordenar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-3 space-y-3" align="start">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Ordenar por</p>
            <Select
              value={filters.sortBy}
              onValueChange={(v) => onFiltersChange({ ...filters, sortBy: v as any })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
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
                  onClick={() => onFiltersChange({ ...filters, sortOrder: o })}
                >
                  {o === "asc" ? "Crescente" : "Decrescente"}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
          onClick={clearAll}
        >
          <XIcon className="size-3" />
          Limpar ({activeCount})
        </Button>
      )}
    </div>
  );
}
