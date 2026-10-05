"use client";

import { addDays, addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ListChecks, MessageSquareText, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import type { NasaPlannerPostStatus, NasaPlannerPostType } from "@/generated/prisma/enums";
import type { PlannerOriginFilter } from "../../hooks/use-planner-board";
import { ClientAvatar } from "./client-avatar";
import { POST_STATUS_META, POST_TYPE_META, POST_TYPES, WEEKDAY_LABELS, isScriptOnlyPost, postDate, type CalendarView } from "./planner-v2-utils";
import type { CalendarPost, PlannerClient } from "./planner-v2-types";

/** Barra do calendário (spec 0058, RF-6): Hoje, navegação, Semana|Mês|Kanban, filtros e o menu Criar. */

const VIEW_LABEL: Record<CalendarView, string> = { week: "Semana", month: "Mês", kanban: "Kanban", script: "Roteiro" };
const ORIGIN_LABEL: Record<PlannerOriginFilter, string> = { all: "Todas", ai: "Criado por IA", human: "Criado pela equipe" };

const FILTERABLE_STATUSES: NasaPlannerPostStatus[] = ["DRAFT", "PENDING_APPROVAL", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED", "PUBLISHED", "FAILED"];

function toggleInList<Item>(list: Item[], item: Item) {
  return list.includes(item) ? list.filter((current) => current !== item) : [...list, item];
}

function FilterOption({ isSelected, onSelect, children }: { isSelected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onSelect} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-panel">
      <span className={cn("grid size-4 place-items-center rounded-full border border-line", isSelected && "border-foreground bg-foreground text-background")}>
        {isSelected && <Check className="size-3" />}
      </span>
      {children}
    </button>
  );
}

interface CalendarToolbarProps {
  view: CalendarView;
  anchorDate: Date;
  clients: PlannerClient[];
  selectedClientIds: string[];
  selectedTypes: NasaPlannerPostType[];
  selectedStatuses: NasaPlannerPostStatus[];
  origin: PlannerOriginFilter;
  onOriginChange: (origin: PlannerOriginFilter) => void;
  onImportCreation: () => void;
  /** Conteúdos do período visível (roteiro da semana), para o filtro "Conteúdo". */
  periodContents: CalendarPost[];
  onOpenPost: (postId: string) => void;
  onImportWeeklyScript: () => void;
  onViewChange: (view: CalendarView) => void;
  onAnchorDateChange: (date: Date) => void;
  onClientIdsChange: (clientIds: string[]) => void;
  onTypesChange: (types: NasaPlannerPostType[]) => void;
  onStatusesChange: (statuses: NasaPlannerPostStatus[]) => void;
  onCreate: (type: NasaPlannerPostType) => void;
  onCreateBroadcast: () => void;
}

export function CalendarToolbar(props: CalendarToolbarProps) {
  const { view, anchorDate, clients, selectedClientIds, selectedTypes, selectedStatuses, origin } = props;
  const isKanban = view === "kanban";
  const step = (direction: 1 | -1) => props.onAnchorDateChange(view === "month" ? addMonths(anchorDate, direction) : addDays(anchorDate, 7 * direction));
  const monthLabel = format(anchorDate, "MMMM 'de' yyyy", { locale: ptBR });
  const periodLabel =
    view === "month" ? `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}` : `Semana de ${format(anchorDate, "d 'de' MMMM", { locale: ptBR })}`;
  const sortedContents = [...props.periodContents].sort((first, second) => (postDate(first)?.getTime() ?? 0) - (postDate(second)?.getTime() ?? 0));
  const hasWhatsAppNumber = clients.some((client) => client.whatsappNumbers.length > 0 && client.permissions.canSchedule);
  const visibleClients = selectedClientIds.length ? clients.filter((client) => selectedClientIds.includes(client.id)) : clients;

  return (
    <div className="flex flex-wrap items-center gap-2 p-3">
      {!isKanban && (
        <div className="flex min-w-0 items-center gap-2 max-md:flex-1">
          <button
            type="button"
            data-guide={GUIDE_ANCHORS.plannerTodayButton.id}
            onClick={() => props.onAnchorDateChange(new Date())}
            className="rounded-full bg-panel px-3.5 py-1.5 text-sm font-medium hover:bg-knob/60"
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => step(-1)}
            className="grid size-8 place-items-center rounded-full bg-panel hover:bg-knob/60"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Próximo" onClick={() => step(1)} className="grid size-8 place-items-center rounded-full bg-panel hover:bg-knob/60">
            <ChevronRight className="size-4" />
          </button>
          <span className="mx-1 min-w-0 truncate text-base font-bold max-md:text-sm">{periodLabel}</span>
        </div>
      )}
      <div data-guide={GUIDE_ANCHORS.plannerViewToggle.id} className="inline-flex rounded-full bg-panel p-[3px] max-md:order-2 max-md:flex max-md:w-full">
        {(["week", "month", "kanban", "script"] as const).map((viewOption) => (
          <button
            key={viewOption}
            type="button"
            onClick={() => props.onViewChange(viewOption)}
            className={cn(
              "rounded-full px-3.5 py-1 text-sm max-md:flex-1 max-md:px-2 max-md:py-1.5",
              view === viewOption ? "bg-foreground font-semibold text-background" : "text-muted-foreground",
            )}
          >
            {VIEW_LABEL[viewOption]}
          </button>
        ))}
      </div>

      <span className="flex-1 max-md:hidden" />

      {/* Celular: os filtros viram uma linha que rola até a borda; no computador seguem soltos na barra. */}
      <div className="scroll-hidden-x flex items-center gap-2 max-md:order-3 max-md:-mx-3 max-md:w-[calc(100%+1.5rem)] max-md:overflow-x-auto max-md:px-3 md:contents [&>button]:shrink-0 [&>button]:whitespace-nowrap">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-guide={GUIDE_ANCHORS.plannerClientFilter.id}
              className="inline-flex items-center gap-2 rounded-full bg-panel py-1 pr-3 pl-1.5 text-sm"
            >
              <span className="flex -space-x-1.5">
                {visibleClients.slice(0, 3).map((client) => (
                  <ClientAvatar key={client.id} name={client.name} logo={client.logo} clientIndex={clients.indexOf(client)} className="ring-card" />
                ))}
              </span>
              {selectedClientIds.length === 0
                ? `Todos os clientes (${clients.length})`
                : `${selectedClientIds.length} cliente${selectedClientIds.length > 1 ? "s" : ""}`}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-72 rounded-[18px] p-1.5">
            <FilterOption isSelected={selectedClientIds.length === 0} onSelect={() => props.onClientIdsChange([])}>
              Todos os clientes
            </FilterOption>
            {clients.map((client, clientIndex) => (
              <FilterOption
                key={client.id}
                isSelected={selectedClientIds.includes(client.id)}
                onSelect={() => props.onClientIdsChange(toggleInList(selectedClientIds, client.id))}
              >
                <ClientAvatar name={client.name} logo={client.logo} clientIndex={clientIndex} />
                <span className="min-w-0 flex-1 truncate">{client.name}</span>
                {client.accounts.length === 0 && <span className="text-[10px] text-warning">sem Instagram</span>}
                {client.accounts.some((account) => account.status === "NEEDS_RECONNECT") && <span className="text-[10px] text-destructive">reconectar</span>}
              </FilterOption>
            ))}
          </PopoverContent>
        </Popover>

        {!isKanban && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-guide={GUIDE_ANCHORS.plannerContentFilter.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1.5 text-sm"
              >
                <ListChecks className="size-3.5" /> Conteúdo{sortedContents.length > 0 && ` (${sortedContents.length})`}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[70dvh] w-[calc(100vw-1.5rem)] max-w-96 overflow-y-auto rounded-[18px] p-1.5">
              <p className="px-2 pt-1 pb-1.5 text-[11px] text-muted-foreground">Conteúdos {view === "month" ? "do mês" : "da semana"}</p>
              {sortedContents.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum conteúdo neste período. Cole o roteiro da semana para começar.</p>
              )}
              {sortedContents.map((content) => {
                const date = postDate(content);
                const isPending = isScriptOnlyPost(content);
                return (
                  <div key={content.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-panel">
                    <span className="w-9 shrink-0 text-[11px] font-bold text-muted-foreground uppercase">
                      {date ? WEEKDAY_LABELS[date.getDay()].slice(0, 3) : "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{content.title || POST_TYPE_META[content.type].label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {POST_TYPE_META[content.type].label}
                        {content.objective ? ` · ${content.objective}` : ""}
                        {!isPending && ` · ${POST_STATUS_META[content.status].label}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => props.onOpenPost(content.id)}
                      className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", isPending ? "bg-foreground text-background" : "bg-knob/60")}
                    >
                      {isPending ? "Criar" : "Abrir"}
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={props.onImportWeeklyScript}
                className="mt-1 w-full rounded-xl px-2 py-2 text-left text-sm font-medium text-info hover:bg-panel"
              >
                + Colar roteiro da semana
              </button>
            </PopoverContent>
          </Popover>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-guide={GUIDE_ANCHORS.plannerTypeFilter.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1.5 text-sm"
            >
              Tipo: {selectedTypes.length === 0 ? "Todos" : selectedTypes.map((type) => POST_TYPE_META[type].label).join(", ")}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 rounded-[18px] p-1.5">
            {POST_TYPES.map((type) => (
              <FilterOption key={type} isSelected={selectedTypes.includes(type)} onSelect={() => props.onTypesChange(toggleInList(selectedTypes, type))}>
                {POST_TYPE_META[type].label}
              </FilterOption>
            ))}
          </PopoverContent>
        </Popover>

        {isKanban && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-guide={GUIDE_ANCHORS.plannerCreationsTab.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1.5 text-sm"
              >
                Origem: {ORIGIN_LABEL[origin]}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 rounded-[18px] p-1.5">
              {(Object.keys(ORIGIN_LABEL) as PlannerOriginFilter[]).map((originOption) => (
                <FilterOption key={originOption} isSelected={origin === originOption} onSelect={() => props.onOriginChange(originOption)}>
                  {ORIGIN_LABEL[originOption]}
                </FilterOption>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {!isKanban && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1.5 text-sm">
                Status: {selectedStatuses.length === 0 ? "Todos" : `${selectedStatuses.length}`}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 rounded-[18px] p-1.5">
              {FILTERABLE_STATUSES.map((status) => (
                <FilterOption
                  key={status}
                  isSelected={selectedStatuses.includes(status)}
                  onSelect={() => props.onStatusesChange(toggleInList(selectedStatuses, status))}
                >
                  <span className={cn("size-2 rounded-full", POST_STATUS_META[status].dotClassName)} />
                  {POST_STATUS_META[status].label}
                </FilterOption>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-guide={GUIDE_ANCHORS.plannerCreateMenu.id}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background max-md:order-1 max-md:ml-auto max-md:px-3"
          >
            <Plus className="size-4" /> Criar <ChevronDown className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-[18px] p-1.5">
          {POST_TYPES.map((type) => {
            const TypeIcon = POST_TYPE_META[type].icon;
            return (
              <DropdownMenuItem key={type} onSelect={() => props.onCreate(type)} className="gap-2.5 rounded-xl py-2">
                <TypeIcon className="size-4" /> {type === "STATIC" ? "Post no feed" : POST_TYPE_META[type].label}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem onSelect={props.onImportWeeklyScript} data-guide={GUIDE_ANCHORS.plannerImportWeeklyScript.id} className="gap-2.5 rounded-xl py-2">
            <ListChecks className="size-4" /> Conteúdo (roteiro da semana)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={props.onImportCreation} className="gap-2.5 rounded-xl py-2">
            <Upload className="size-4" /> Trouxe de outra IA?
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground uppercase">Em breve (Fase 3)</DropdownMenuLabel>
          {["Programar posts em massa", "Carregar reels em massa", "Reel em várias páginas"].map((label) => (
            <DropdownMenuItem key={label} disabled className="rounded-xl py-2 text-sm">
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!hasWhatsAppNumber} onSelect={props.onCreateBroadcast} className="flex-col items-start gap-0 rounded-xl py-2">
            <span className="flex items-center gap-2.5 text-sm">
              <MessageSquareText className="size-4" /> Disparo WhatsApp
            </span>
            {!hasWhatsAppNumber && <span className="pl-6.5 text-[11px] text-muted-foreground">Conecte um número da API Oficial nas Campanhas</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
