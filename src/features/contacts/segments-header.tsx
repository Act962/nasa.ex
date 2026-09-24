"use client";

import { useState } from "react";
import {
  useContactsFilters,
  type LeadSegment,
} from "./hooks/use-contacts-filters";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLeadSegments } from "./hooks/use-lead-segments";
import {
  ChevronDown,
  Sparkles,
  Trophy,
  HeartHandshake,
  AlertTriangle,
  Tag,
  Users,
  X,
} from "lucide-react";
import { DateRangeTimePicker } from "@/features/insights/components/activities/date-range-time-picker";

type DateField = "createdAt" | "lastInboundAt";

const DATE_FIELD_LABELS: Record<DateField, string> = {
  createdAt: "Data de criação",
  lastInboundAt: "Última interação",
};

/** Todos os trackings; o filtro é opt-in, não um funil escolhido por nós. */
const ALL_TRACKINGS = "todos";

interface SegmentCard {
  key: string;
  /** `undefined` no Total: ele é a ausência de recorte, não um recorte. */
  segment?: LeadSegment;
  label: string;
  value?: number;
  hint: string;
  icon: typeof Sparkles;
  tone: string;
}

export function SegmentsHeader() {
  const filters = useContactsFilters();
  const trackingId = filters.trackingId ?? ALL_TRACKINGS;
  const { tagIds, dateField, segment } = filters;
  const range = { from: filters.from, to: filters.to };

  const setTrackingId = (value: string) =>
    filters.setTrackingId(value === ALL_TRACKINGS ? undefined : value);
  const setTagIds = (ids: string[]) => filters.setTagIds(ids);
  const setDateField = (field: DateField) => filters.setDateField(field);
  const setRange = (value: { from?: Date; to?: Date }) => filters.setRange(value);

  const { data, isLoading } = useLeadSegments({
    trackingId: filters.trackingId,
    tagIds,
    dateField,
    from: filters.from,
    to: filters.to,
  });

  const rules = data?.regras;
  const cards: SegmentCard[] = [
    {
      key: "total",
      label: "Total",
      value: data?.total,
      hint: "Todos os leads do recorte atual",
      icon: Users,
      tone: "text-muted-foreground",
    },
    {
      key: "novos",
      segment: "novos",
      label: "Novos",
      value: data?.novos,
      hint: `Criados nos últimos ${rules?.novosDias ?? 30} dias e ainda no funil`,
      icon: Sparkles,
      tone: "text-sky-500",
    },
    {
      key: "campeoes",
      segment: "campeoes",
      label: "Lead campeão",
      value: data?.campeoes,
      hint: "Leads marcados como ganhos",
      icon: Trophy,
      tone: "text-amber-500",
    },
    {
      key: "leais",
      segment: "leais",
      label: "Leais",
      value: data?.leais,
      hint: `Conversa com ${rules?.leaisMensagens ?? 10} mensagens ou mais`,
      icon: HeartHandshake,
      tone: "text-emerald-500",
    },
    {
      key: "risco",
      segment: "risco",
      label: "Risco",
      value: data?.emRisco,
      hint: `Sem mensagem recebida há mais de ${rules?.riscoDias ?? 7} dias`,
      icon: AlertTriangle,
      tone: "text-rose-500",
    },
  ];

  const toggleTag = (id: string) =>
    setTagIds(
      tagIds.includes(id)
        ? tagIds.filter((tagId) => tagId !== id)
        : [...tagIds, id],
    );

  const selectedTagNames = (data?.tags ?? [])
    .filter((tag) => tagIds.includes(tag.id))
    .map((tag) => tag.name);

  return (
    <div className="px-4 py-3 border-b">
      <div className="flex flex-wrap items-center gap-2">
        {cards.map((card) => {
          const active = segment === card.segment;
          return (
          <button
            key={card.key}
            type="button"
            title={`${card.hint}. Clique para filtrar a lista.`}
            aria-pressed={active}
            onClick={() => filters.toggleSegment(card.segment)}
            className={cn(
              "flex min-w-[9.5rem] flex-1 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
              active
                ? "border-primary bg-primary/10"
                : "bg-card hover:bg-muted/50",
            )}
          >
            <card.icon className={cn("size-4 shrink-0", card.tone)} />
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{card.label}</p>
              {isLoading ? (
                <Skeleton className="mt-0.5 h-5 w-8" />
              ) : (
                <p className="text-lg font-semibold leading-tight">
                  {card.value ?? 0}
                </p>
              )}
            </div>
          </button>
          );
        })}

        {/* Tag é multidropdown: um lead tem várias, e filtrar por uma só
            esconderia o cruzamento que o usuário quer ver. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-[3.25rem] min-w-[9.5rem] flex-1 justify-between gap-2 px-3"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Tag className="size-4 shrink-0 text-violet-500" />
                <span className="min-w-0 text-left">
                  <span className="block text-xs text-muted-foreground">Tag</span>
                  <span className="block truncate text-sm font-medium">
                    {selectedTagNames.length === 0
                      ? "Todas"
                      : selectedTagNames.length === 1
                        ? selectedTagNames[0]
                        : `${selectedTagNames.length} tags`}
                  </span>
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filtrar por tag</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(data?.tags ?? []).length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Nenhuma tag cadastrada.
              </div>
            ) : (
              (data?.tags ?? []).map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={tagIds.includes(tag.id)}
                  onCheckedChange={() => toggleTag(tag.id)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span
                    className="mr-2 inline-block size-2 rounded-full"
                    style={{ backgroundColor: tag.color ?? "#1447e6" }}
                  />
                  {tag.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
            {tagIds.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => setTagIds([])}
                  className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar seleção
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select
          value={dateField}
          onValueChange={(value) => setDateField(value as DateField)}
        >
          <SelectTrigger className="h-[3.25rem] min-w-[9.5rem] flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DATE_FIELD_LABELS) as DateField[]).map((field) => (
              <SelectItem key={field} value={field}>
                {DATE_FIELD_LABELS[field]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <DateRangeTimePicker
            from={range.from}
            to={range.to}
            onChange={setRange}
          />
          {(range.from || range.to) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Limpar período"
              onClick={() => setRange({})}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <Select value={trackingId} onValueChange={setTrackingId}>
          <SelectTrigger className="h-[3.25rem] min-w-[9.5rem] flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TRACKINGS}>Todos os trackings</SelectItem>
            {(data?.trackings ?? []).map((tracking) => (
              <SelectItem key={tracking.id} value={tracking.id}>
                {tracking.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
