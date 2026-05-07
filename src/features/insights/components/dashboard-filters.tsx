"use client";

import { CalendarIcon, PlusIcon, SettingsIcon, TagIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { cn } from "@/lib/utils";
import type { DateRange } from "@/features/insights/types";
import { useTags } from "@/features/tags/hooks/use-tags";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TagModal } from "@/features/trackings/components/modal/add-tag-sheet";
import { useState } from "react";
import dayjs from "dayjs";
import { pt } from "react-day-picker/locale";

interface DashboardFiltersProps {
  trackingId?: string;
  tagIds: string[];
  dateRange: DateRange;
  trackingOptions: { id: string; name: string }[];
  onTrackingChange: (id: string) => void;
  organizationIds: string[];
  onOrganizationToggle: (id: string) => void;
  showTrackingFilter?: boolean;
  showTagsFilter?: boolean;

  organizationOptions: { id: string; name: string }[];
  onTagToggle: (tagId: string) => void;
  onDateRangeChange: (range: DateRange) => void;

  // Filtro de workspaces (Insights)
  workspaceIds?: string[];
  workspaceOptions?: { id: string; name: string }[];
  onWorkspaceToggle?: (id: string) => void;
}

export function DashboardFilters({
  trackingId,
  tagIds,
  dateRange,
  trackingOptions,
  onTrackingChange,
  onTagToggle,
  onDateRangeChange,
  organizationIds,
  organizationOptions,
  onOrganizationToggle,
  workspaceIds = [],
  workspaceOptions = [],
  onWorkspaceToggle,
  showTrackingFilter = true,
  showTagsFilter = true,
}: DashboardFiltersProps) {
  const { tags: allTags } = useTags({ trackingId });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <OrganizationFilterButton
          options={organizationOptions}
          selectedIds={organizationIds}
          onToggle={onOrganizationToggle}
        />
        {onWorkspaceToggle && workspaceOptions.length > 0 && (
          <WorkspaceFilterButton
            options={workspaceOptions}
            selectedIds={workspaceIds}
            onToggle={onWorkspaceToggle}
          />
        )}
        {showTrackingFilter && <Select value={trackingId ?? "ALL"} onValueChange={onTrackingChange}>
          <SelectTrigger className="w-full sm:w-50">
            <SelectValue placeholder="Selecione um tracking" />
          </SelectTrigger>
          <SelectContent>
            {trackingOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal sm:w-70",
                !dateRange.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                "Selecione o período"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              locale={pt}
              mode="range"
              timeZone="America/Sao_Paulo"
              defaultMonth={dateRange.from}
              selected={{
                from: dayjs(dateRange.from).startOf("day").toDate(),
                to: dayjs(dateRange.to).endOf("day").toDate(),
              }}
              onSelect={(range) =>
                onDateRangeChange({
                  from: dayjs(range?.from).startOf("day").toDate(),
                  to: dayjs(range?.to).endOf("day").toDate(),
                })
              }
              numberOfMonths={2}
            />
            <div className="flex items-center justify-between border-t p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onDateRangeChange({ from: undefined, to: undefined })
                }
              >
                Limpar
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const thirtyDaysAgo = new Date(now);
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    onDateRangeChange({ from: thirtyDaysAgo, to: now });
                  }}
                >
                  Últimos 30 dias
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const ninetyDaysAgo = new Date(now);
                    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                    onDateRangeChange({ from: ninetyDaysAgo, to: now });
                  }}
                >
                  Últimos 90 dias
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {showTagsFilter && (
          <div className="flex flex-wrap items-center gap-1">
            <AddTagFilterButton
              allTags={allTags || []}
              selectedTagIds={tagIds}
              onTagToggle={onTagToggle}
              trackingId={trackingId ?? ""}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AddTagFilterButton({
  allTags,
  selectedTagIds,
  onTagToggle,
  trackingId,
}: {
  allTags: any[];
  selectedTagIds: string[];
  onTagToggle: (id: string) => void;
  trackingId: string;
}) {
  const [open, setOpen] = useState(false);
  const [openTagModal, setOpenTagModal] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="outline">
                {selectedTagIds && selectedTagIds.length > 0 ? (
                  <>
                    <TagIcon className="size-4" /> {selectedTagIds.length}{" "}
                    Selecionadas
                  </>
                ) : (
                  <>
                    Adicionar Tags
                    <PlusIcon className="h-3 w-3" />
                  </>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Filtrar por tags</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Filtrar tags..." />
            <CommandList>
              <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {allTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    onSelect={() => onTagToggle(tag.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox checked={selectedTagIds.includes(tag.id)} />
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span>{tag.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="border-t p-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setOpenTagModal(true)}
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <TagModal
        trackingId={trackingId === "ALL" ? undefined : trackingId}
        open={openTagModal}
        onOpenChange={setOpenTagModal}
      />
    </>
  );
}

function OrganizationFilterButton({
  options,
  selectedIds,
  onToggle,
}: {
  options: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full sm:w-50 justify-between">
          <span className="truncate">
            {selectedIds.length === 0
              ? "Todas as Empresas"
              : selectedIds.length === 1
                ? options.find((o) => o.id === selectedIds[0])?.name
                : `${selectedIds.length} Empresas`}
          </span>
          <PlusIcon className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Filtrar empresas..." />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => onToggle(option.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={
                      option.id === "ALL"
                        ? selectedIds.length === 0
                        : selectedIds.includes(option.id)
                    }
                  />
                  <span>{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function WorkspaceFilterButton({
  options,
  selectedIds,
  onToggle,
}: {
  options: { id: string; name: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const realOptions = options.filter((o) => o.id !== "ALL");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full sm:w-50 justify-between">
          <span className="truncate">
            {selectedIds.length === 0
              ? "Todos os Workspaces"
              : selectedIds.length === 1
                ? realOptions.find((o) => o.id === selectedIds[0])?.name
                : `${selectedIds.length} Workspaces`}
          </span>
          <PlusIcon className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Filtrar workspaces..." />
          <CommandList>
            <CommandEmpty>Nenhum workspace encontrado.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              <CommandItem
                onSelect={() => onToggle("ALL")}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox checked={selectedIds.length === 0} />
                <span>Todos os Workspaces</span>
              </CommandItem>
              {realOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  onSelect={() => onToggle(option.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox checked={selectedIds.includes(option.id)} />
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
