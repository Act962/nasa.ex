"use client";

import { useState, useMemo } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import {
  CalendarIcon,
  CheckSquareIcon,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useWorkspaceCalendar } from "@/features/actions/hooks/use-tasks";
import { ViewActionModal } from "@/features/actions/components/view-action-modal";
import { CreateActionModal } from "@/features/actions/components/create-action-modal";
import { cn } from "@/lib/utils";
import {
  WorkspaceCalendarMonthGrid,
  type WorkspaceCalendarAction,
} from "./workspace-calendar-month-grid";
import { WorkspaceCalendarEventList } from "./workspace-calendar-event-list";
import {
  WorkspaceCalendarFilters,
  type ActionPriority,
} from "./workspace-calendar-filters";

dayjs.locale("pt-br");

const PALETTE = [
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceCalendarModal({ open, onOpenChange }: Props) {
  const [cursor, setCursor] = useState<Dayjs>(dayjs().startOf("month"));
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedOrgProjectIds, setSelectedOrgProjectIds] = useState<
    Set<string>
  >(new Set());
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<
    Set<string>
  >(new Set());
  const [selectedPriorities, setSelectedPriorities] = useState<
    Set<ActionPriority>
  >(new Set());
  const [search, setSearch] = useState("");
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"month" | "week" | "agenda">(
    "month",
  );

  // Estado pra criar evento via click numa data (gateway de workspace)
  const [createForDate, setCreateForDate] = useState<Dayjs | null>(null);
  const [createWorkspaceId, setCreateWorkspaceId] = useState<string | null>(
    null,
  );

  const { data: allWorkspacesData } = useQuery({
    ...orpc.workspace.list.queryOptions({ input: {} }),
    enabled: open,
  });
  const allWorkspaces = useMemo(() => {
    const list = (allWorkspacesData as { workspaces?: Array<{ id: string; name: string }> })?.workspaces;
    return list ?? [];
  }, [allWorkspacesData]);

  const startDate = cursor.startOf("month").format("YYYY-MM-DD");
  const endDate = cursor.endOf("month").format("YYYY-MM-DD");

  const { actions, isLoading } = useWorkspaceCalendar({ startDate, endDate });

  const typedActions = actions as unknown as WorkspaceCalendarAction[];

  // Workspaces que TÊM ações no mês (usado pra stats e overlay).
  const workspaces = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    typedActions.forEach((a) => {
      if (a.workspaceId && a.workspace) {
        map.set(a.workspaceId, { id: a.workspaceId, name: a.workspace.name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [typedActions]);

  // Lista pra o filtro: TODOS os workspaces da org (mesmo sem eventos no mês),
  // pra o user poder filtrar e ver. Inclui também os workspaces presentes nas
  // ações (caso `allWorkspaces` ainda não tenha carregado).
  const filterWorkspaces = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    allWorkspaces.forEach((ws) => {
      map.set(ws.id, { id: ws.id, name: ws.name });
    });
    workspaces.forEach((ws) => {
      if (!map.has(ws.id)) map.set(ws.id, ws);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allWorkspaces, workspaces]);

  const workspaceColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    filterWorkspaces.forEach((ws, i) => {
      map[ws.id] = PALETTE[i % PALETTE.length];
    });
    workspaces.forEach((ws) => {
      if (!map[ws.id]) {
        map[ws.id] = PALETTE[Object.keys(map).length % PALETTE.length];
      }
    });
    return map;
  }, [filterWorkspaces, workspaces]);

  // Clientes/Projetos disponíveis (deduzidos das ações do mês)
  const orgProjects = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; type?: string | null; color?: string | null }
    >();
    typedActions.forEach((a) => {
      if (a.orgProjectId && a.orgProject) {
        map.set(a.orgProjectId, {
          id: a.orgProjectId,
          name: a.orgProject.name,
          type: a.orgProject.type,
          color: a.orgProject.color,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [typedActions]);

  // Leads disponíveis (deduzidos das ações do mês)
  const leads = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    typedActions.forEach((a) => {
      if (a.leadId && a.lead) {
        map.set(a.leadId, { id: a.leadId, name: a.lead.name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [typedActions]);

  // Responsáveis e Participantes (deduzidos das ações do mês — quem aparece
  // em pelo menos uma ação fica disponível pra filtrar). Tratamos como o mesmo
  // conjunto de "pessoas envolvidas" pra simplificar o filtro.
  const responsibles = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; image?: string | null }
    >();
    typedActions.forEach((a) => {
      [...(a.responsibles ?? []), ...(a.participants ?? [])].forEach((p) => {
        if (p.user) {
          map.set(p.user.id, {
            id: p.user.id,
            name: p.user.name,
            image: p.user.image ?? null,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [typedActions]);

  const filteredActions = useMemo(() => {
    return typedActions.filter((a) => {
      if (
        selectedWorkspaceIds.size > 0 &&
        (!a.workspaceId || !selectedWorkspaceIds.has(a.workspaceId))
      ) {
        return false;
      }
      if (
        selectedOrgProjectIds.size > 0 &&
        (!a.orgProjectId || !selectedOrgProjectIds.has(a.orgProjectId))
      ) {
        return false;
      }
      if (
        selectedLeadIds.size > 0 &&
        (!a.leadId || !selectedLeadIds.has(a.leadId))
      ) {
        return false;
      }
      // Prioridade: action passa se sua priority está no Set selecionado
      if (selectedPriorities.size > 0) {
        const p = (a.priority ?? null) as ActionPriority | null;
        if (!p || !selectedPriorities.has(p)) return false;
      }
      // Responsável: passa se ALGUM dos responsibles/participants está no Set
      if (selectedResponsibleIds.size > 0) {
        const involvedIds = new Set<string>();
        (a.responsibles ?? []).forEach(
          (r) => r.user && involvedIds.add(r.user.id),
        );
        (a.participants ?? []).forEach(
          (p) => p.user && involvedIds.add(p.user.id),
        );
        const hasMatch = Array.from(selectedResponsibleIds).some((id) =>
          involvedIds.has(id),
        );
        if (!hasMatch) return false;
      }
      if (showOnlyPending && a.isDone) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!a.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [
    typedActions,
    selectedWorkspaceIds,
    selectedOrgProjectIds,
    selectedLeadIds,
    selectedPriorities,
    selectedResponsibleIds,
    search,
    showOnlyPending,
  ]);

  const toggleSet = (
    setter: (fn: (prev: Set<string>) => Set<string>) => void,
  ) => (id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setSelectedWorkspaceIds(new Set());
    setSelectedOrgProjectIds(new Set());
    setSelectedLeadIds(new Set());
    setSelectedResponsibleIds(new Set());
    setSelectedPriorities(new Set());
    setSearch("");
    setShowOnlyPending(false);
  };

  const togglePriority = (p: ActionPriority) => {
    setSelectedPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const filtersNode = (
    <WorkspaceCalendarFilters
      workspaces={filterWorkspaces}
      workspaceColorMap={workspaceColorMap}
      selectedWorkspaceIds={selectedWorkspaceIds}
      orgProjects={orgProjects}
      selectedOrgProjectIds={selectedOrgProjectIds}
      leads={leads}
      selectedLeadIds={selectedLeadIds}
      responsibles={responsibles}
      selectedResponsibleIds={selectedResponsibleIds}
      selectedPriorities={selectedPriorities}
      search={search}
      showOnlyPending={showOnlyPending}
      onToggleWorkspace={toggleSet(setSelectedWorkspaceIds)}
      onClearWorkspaces={() => setSelectedWorkspaceIds(new Set())}
      onToggleOrgProject={toggleSet(setSelectedOrgProjectIds)}
      onClearOrgProjects={() => setSelectedOrgProjectIds(new Set())}
      onToggleLead={toggleSet(setSelectedLeadIds)}
      onClearLeads={() => setSelectedLeadIds(new Set())}
      onToggleResponsible={toggleSet(setSelectedResponsibleIds)}
      onClearResponsibles={() => setSelectedResponsibleIds(new Set())}
      onTogglePriority={togglePriority}
      onClearPriorities={() => setSelectedPriorities(new Set())}
      onSearchChange={setSearch}
      onTogglePending={setShowOnlyPending}
      onReset={reset}
      defaultOpen
    />
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none p-0 sm:h-[95vh] sm:w-[95vw] sm:max-w-[95vw] sm:rounded-lg">
          <DialogTitle className="sr-only">Calendário Workspace</DialogTitle>

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-500">
                <CalendarIcon className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold sm:text-lg">
                  Calendário Workspace
                </h1>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                  Visão consolidada de todas as ações que você participa
                </p>
              </div>
            </div>

            {/* Stats — escondidos em mobile (a barra superior do body já mostra
                "N ações" no fluxo mobile via Sheet de filtros) */}
            <div className="hidden shrink-0 items-center gap-4 text-xs text-muted-foreground lg:flex">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <CheckSquareIcon className="size-3.5" />
                {filteredActions.length} ações no mês
              </div>
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <CalendarIcon className="size-3.5" />
                {workspaces.length} workspaces
              </div>
            </div>
          </div>

          {/* Body com layout idêntico ao /calendario */}
          <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
            {/* Filters sidebar — desktop colapsável */}
            <div
              className={cn(
                "hidden shrink-0 overflow-hidden border-r border-border/60 transition-all duration-200 lg:flex lg:flex-col",
                sidebarOpen ? "lg:w-[260px]" : "lg:w-0 lg:border-r-0",
              )}
            >
              <div className="w-[260px]">{filtersNode}</div>
            </div>

            {/* Mobile filters trigger */}
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 lg:hidden">
              <div>
                <h2 className="font-semibold">Ações</h2>
                <p className="text-xs text-muted-foreground">
                  {filteredActions.length} ação
                  {filteredActions.length === 1 ? "" : "ões"}
                </p>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                    Filtros
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[90dvh]">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  {filtersNode}
                </SheetContent>
              </Sheet>
            </div>

            {/* Calendar central */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {/* Toolbar desktop */}
              <div className="hidden items-center gap-2 border-b border-border/60 px-3 py-2 lg:flex">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen((v) => !v)}
                  title={sidebarOpen ? "Ocultar filtros" : "Mostrar filtros"}
                  className="shrink-0"
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {filteredActions.length} ação
                  {filteredActions.length === 1 ? "" : "ões"}
                </span>
                {workspaces.length > 0 && (
                  <div className="ml-2 flex items-center gap-2 overflow-x-auto">
                    {workspaces.map((ws) => (
                      <div
                        key={ws.id}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <div
                          className="size-2 rounded-full"
                          style={{ backgroundColor: workspaceColorMap[ws.id] }}
                        />
                        <span>{ws.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* View switcher */}
                <div className="ml-auto flex items-center gap-0.5 rounded-md border bg-background p-0.5 text-xs">
                  {(
                    [
                      { id: "month", label: "Mês" },
                      { id: "week", label: "Semana" },
                      { id: "agenda", label: "Agenda" },
                    ] as const
                  ).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setViewMode(v.id)}
                      className={cn(
                        "rounded px-2 py-1 transition-colors",
                        viewMode === v.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {isLoading ? (
                  <div className="grid h-full grid-cols-7 gap-1 p-3">
                    {Array(35)
                      .fill(0)
                      .map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                      ))}
                  </div>
                ) : (
                  <>
                    {/* Mobile (< lg): sempre lista de agenda — o grid de mês
                        não cabe em telas pequenas. View switcher do desktop é
                        ignorado aqui pra UX consistente. */}
                    <div className="h-full overflow-y-auto lg:hidden">
                      <WorkspaceCalendarEventList
                        actions={filteredActions}
                        workspaceColorMap={workspaceColorMap}
                        selectedId={selectedActionId}
                        onSelect={(a) => setSelectedActionId(a.id)}
                      />
                    </div>

                    {/* Desktop: respeita o view switcher (mês/semana/agenda) */}
                    <div className="hidden h-full lg:block">
                      {viewMode === "month" ? (
                        <WorkspaceCalendarMonthGrid
                          actions={filteredActions}
                          workspaceColorMap={workspaceColorMap}
                          cursor={cursor}
                          onCursorChange={setCursor}
                          onSelect={(a) => setSelectedActionId(a.id)}
                          selectedId={selectedActionId}
                          onCreateForDate={(d) => {
                            setCreateForDate(d);
                            if (allWorkspaces.length === 1) {
                              setCreateWorkspaceId(allWorkspaces[0].id);
                            }
                          }}
                          showCreateOnHover
                        />
                      ) : viewMode === "agenda" ? (
                        <div className="h-full overflow-y-auto">
                          <WorkspaceCalendarEventList
                            actions={filteredActions}
                            workspaceColorMap={workspaceColorMap}
                            selectedId={selectedActionId}
                            onSelect={(a) => setSelectedActionId(a.id)}
                          />
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                          <CalendarIcon className="size-8 text-muted-foreground/50" />
                          <div>
                            <h3 className="text-sm font-semibold">
                              Visão Semana
                            </h3>
                            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                              Em breve: 7 colunas com horas. Por enquanto use
                              Mês ou Agenda.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewMode("month")}
                          >
                            Voltar pra Mês
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right list — sempre visível desktop, exceto na view Agenda
                (já é a vista principal) */}
            <div
              className={cn(
                "hidden w-[300px] shrink-0 border-l border-border/60 lg:block",
                viewMode === "agenda" && "lg:hidden",
              )}
            >
              <WorkspaceCalendarEventList
                actions={filteredActions}
                workspaceColorMap={workspaceColorMap}
                selectedId={selectedActionId}
                onSelect={(a) => setSelectedActionId(a.id)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedActionId && (
        <ViewActionModal
          actionId={selectedActionId}
          open={!!selectedActionId}
          onOpenChange={(v) => {
            if (!v) setSelectedActionId(null);
          }}
        />
      )}

      {/* Workspace picker — quando há múltiplos workspaces e o user clicou
          numa data sem ter selecionado workspace ainda. */}
      {createForDate && !createWorkspaceId && allWorkspaces.length > 1 && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setCreateForDate(null);
              setCreateWorkspaceId(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Criar evento em{" "}
                {createForDate.format("DD [de] MMMM [de] YYYY")}
              </DialogTitle>
              <DialogDescription>
                Em qual workspace você quer criar este evento?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {allWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setCreateWorkspaceId(ws.id)}
                  className="flex w-full items-center gap-3 rounded-md border bg-background hover:bg-muted/50 transition-colors p-3 text-left"
                >
                  <div
                    className="size-3 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        workspaceColorMap[ws.id] ?? "#7c3aed",
                    }}
                  />
                  <span className="text-sm font-medium">{ws.name}</span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Empty state — sem workspaces */}
      {createForDate && allWorkspaces.length === 0 && (
        <Dialog
          open
          onOpenChange={() => {
            setCreateForDate(null);
            setCreateWorkspaceId(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sem workspaces</DialogTitle>
              <DialogDescription>
                Você precisa criar pelo menos um workspace antes de criar
                eventos no calendário.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}

      {/* Create action modal — pre-filled com data e workspace */}
      {createForDate && createWorkspaceId && (
        <CreateActionModal
          open
          onOpenChange={(v) => {
            if (!v) {
              setCreateForDate(null);
              setCreateWorkspaceId(null);
            }
          }}
          workspaceId={createWorkspaceId}
          defaultStartDate={createForDate.startOf("day").toDate()}
          defaultDueDate={createForDate.endOf("day").toDate()}
        />
      )}
    </>
  );
}
