"use client";

import { useMemo, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { parseAsArrayOf, parseAsIsoDate, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { CalendarDays, Columns3, LayoutDashboard, Layers, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import type { NasaPlannerPostStatus, NasaPlannerPostType } from "@/generated/prisma/enums";
import { usePlannerCalendarPosts, usePlannerClients, usePlannerSlots } from "../../hooks/use-planner-calendar";
import { collapsePublishGroups } from "../../lib/publish-group-collapse";
import { useRetryPlannerPublish, useSchedulePlannerPostV2 } from "../../hooks/use-planner-publishing";
import { useUpdatePlannerPostV2 } from "../../hooks/use-planner-planning";
import { usePlannerCalendarBroadcasts } from "../../hooks/use-planner-integrations";
import { BroadcastComposer } from "./broadcast-composer";
import { CalendarToolbar } from "./calendar-toolbar";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";
import { MobileAgenda } from "./mobile-agenda";
import { KanbanView } from "./kanban-view";
import { PlannerDashboard, type DashboardTarget } from "./planner-dashboard";
import { BOARD_COLUMN_KEYS } from "../../hooks/use-planner-board";
import { ClientWorkspaceTab } from "./client-workspace-tab";
import { ImportCreationDialog } from "./import-creation-dialog";
import { ImportWeeklyScriptDialog } from "./import-weekly-script-dialog";
import { ScriptTableView } from "./script-table-view";
import { usePlannerWeekdayThemes } from "../../hooks/use-planner-weekly-script";
import { CampaignsTab } from "../tabs/campaigns-tab";
import { MindMapsTab } from "../tabs/mind-maps-tab";
import { BrandKitPage } from "../brand-kit/brand-kit-page";
import { ClientSelect } from "./client-select";
import { PostComposer } from "./post-composer";
import { POST_TYPES, RESCHEDULABLE_STATUSES, computeVisibleRange, resolvePostInstagramAccount } from "./planner-v2-utils";
import type { CalendarSlot, ComposerRequest } from "./planner-v2-types";

/** Planner v2 (spec 0058): abas Dashboard, Calendário (Semana/Mês/Kanban), Campanhas, Mapas Mentais e Kit da Marca, multi-cliente. */

const STATUS_VALUES: NasaPlannerPostStatus[] = ["IDEA", "DRAFT", "PENDING_APPROVAL", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "FAILED"];
const PLANNER_TABS = ["dashboard", "calendar", "campaigns", "mindmaps", "kit"] as const;
type PlannerTab = (typeof PLANNER_TABS)[number];
const TAB_LABEL: Record<PlannerTab, string> = { dashboard: "Dashboard", calendar: "Calendário", campaigns: "Campanhas", mindmaps: "Mapas Mentais", kit: "Kit da Marca" };
const DRAG_ACTIVATION_DISTANCE_PX = 6;

const plannerSearchParams = {
  tab: parseAsStringLiteral(PLANNER_TABS).withDefault("dashboard"),
  view: parseAsStringLiteral(["week", "month", "kanban", "script"] as const).withDefault("week"),
  origin: parseAsStringLiteral(["all", "ai", "human"] as const).withDefault("all"),
  column: parseAsStringLiteral(BOARD_COLUMN_KEYS),
  date: parseAsIsoDate,
  orgs: parseAsArrayOf(parseAsString).withDefault([]),
  /** Contas do Instagram em vista no calendário (ID na rede); vazio = todas. */
  contas: parseAsArrayOf(parseAsString).withDefault([]),
  types: parseAsArrayOf(parseAsStringLiteral(POST_TYPES)).withDefault([]),
  status: parseAsArrayOf(parseAsStringLiteral(STATUS_VALUES)).withDefault([]),
  post: parseAsString,
  /** Cliente do Kit da Marca em tela. */
  org: parseAsString,
};

export function PlannerHome() {
  const [searchState, setSearchState] = useQueryStates(plannerSearchParams);
  const [composerRequest, setComposerRequest] = useState<ComposerRequest | null>(null);
  const [isBroadcastComposerOpen, setIsBroadcastComposerOpen] = useState(false);
  const [isImportCreationOpen, setIsImportCreationOpen] = useState(false);
  const [isWeeklyScriptOpen, setIsWeeklyScriptOpen] = useState(false);
  const anchorDate = useMemo(() => searchState.date ?? new Date(), [searchState.date]);
  const calendarView = searchState.view === "month" ? "month" : "week";
  const range = useMemo(() => computeVisibleRange(calendarView, anchorDate), [calendarView, anchorDate]);
  const organizationIds = searchState.orgs.length ? searchState.orgs : undefined;

  const { clients } = usePlannerClients();
  const { posts: allPosts } = usePlannerCalendarPosts({
    organizationIds,
    ...range,
    types: searchState.types.length ? searchState.types : undefined,
    statuses: searchState.status.length ? searchState.status : undefined,
  });
  const posts = useMemo(() => {
    // Sem filtro de conta, as contas do mesmo conteúdo viram um cartão só (spec 0074, RF-14).
    if (searchState.contas.length === 0) return collapsePublishGroups(allPosts);
    return allPosts.filter((post) => {
      const account = resolvePostInstagramAccount(post, clients.find((client) => client.id === post.organizationId));
      return account ? searchState.contas.includes(account.igUserId) : false;
    });
  }, [allPosts, clients, searchState.contas]);
  const { slots } = usePlannerSlots({ organizationIds, ...range });
  const { broadcasts: allBroadcasts } = usePlannerCalendarBroadcasts({ organizationIds, ...range });
  // Filtrar por formato de post esconde os disparos: o filtro fala de conteúdo das redes.
  const broadcasts = searchState.types.length || searchState.status.length ? [] : allBroadcasts;
  const { themes: weekdayThemes } = usePlannerWeekdayThemes(organizationIds);
  // Tema do dia é por cliente: só aparece com um cliente em vista.
  const themeClient = organizationIds?.length === 1 ? (clients.find((client) => client.id === organizationIds[0]) ?? null) : clients.length === 1 ? clients[0] : null;
  const schedulePost = useSchedulePlannerPostV2();
  const updatePost = useUpdatePlannerPostV2();
  const retryPublish = useRetryPlannerPublish();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }));

  const pendingApprovalCount = clients
    .filter((client) => !organizationIds || organizationIds.includes(client.id))
    .reduce((total, client) => total + client.counts.pendingApproval, 0);
  const brandKitOrganizationId = searchState.org ?? clients[0]?.id ?? null;
  const activeComposerRequest: ComposerRequest | null = composerRequest ?? (searchState.post ? { mode: "edit", postId: searchState.post } : null);

  const openPost = (postId: string) => setComposerRequest({ mode: "edit", postId });
  const openCreate = (type: NasaPlannerPostType, intendedAt?: Date) =>
    setComposerRequest({ mode: "create", type, intendedAt, organizationId: organizationIds?.length === 1 ? organizationIds[0] : undefined });
  const closeComposer = () => {
    setComposerRequest(null);
    if (searchState.post) void setSearchState({ post: null });
  };
  const retryPost = (postId: string) =>
    retryPublish.mutate({ postId }, { onSuccess: () => toast.success("Tentando publicar de novo."), onError: (error) => toast.error(error.message) });
  const programSlot = (slot: CalendarSlot) => openCreate(slot.postTypes[0] ?? "STATIC", new Date(slot.startsAt));

  // A aba Calendário sempre abre no calendário (Semana/Mês); o Kanban é uma opção dentro dela.
  const showTab = (tab: PlannerTab) =>
    void setSearchState({ tab, column: null, ...(tab === "calendar" && searchState.view === "kanban" && { view: "week" as const }) });
  const navigateFromDashboard = (target: DashboardTarget) => {
    if (target.kind === "kanban") void setSearchState({ tab: "calendar", view: "kanban", column: target.column ?? null });
    else if (target.kind === "calendar") void setSearchState({ tab: "calendar", view: "week", date: null, column: null });
    else void setSearchState({ orgs: [target.organizationId] });
  };
  const isKanban = searchState.tab === "calendar" && searchState.view === "kanban";
  useRegisterOrbitDock({
    leftItems: [
      { label: "Dashboard", icon: <LayoutDashboard />, onSelect: () => showTab("dashboard"), isActive: searchState.tab === "dashboard" },
      { label: "Calendário", icon: <CalendarDays />, onSelect: () => void setSearchState({ tab: "calendar", view: "week", date: null }), isActive: searchState.tab === "calendar" && !isKanban },
    ],
    rightItems: [
      { label: "Kanban", icon: <Columns3 />, onSelect: () => void setSearchState({ tab: "calendar", view: "kanban" }), isActive: isKanban, badgeCount: pendingApprovalCount },
      { label: "Planners", icon: <Layers />, href: "/nasa-planner/planners" },
    ],
    centerAction: { label: "Criar", icon: <Plus />, onSelect: () => openCreate("STATIC") },
  });

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const dragged = active.data.current as { kind: "post" | "draft"; postId: string; status?: NasaPlannerPostStatus; isGroup?: boolean } | undefined;
    const dropTarget = over?.data.current as { date: string; keepTime?: boolean } | undefined;
    if (!dragged || !dropTarget) return;
    const targetDate = new Date(dropTarget.date);
    const draggedPost = posts.find((post) => post.id === dragged.postId);
    if (dropTarget.keepTime) {
      const originalDate = draggedPost?.scheduledAt ? new Date(draggedPost.scheduledAt) : null;
      targetDate.setHours(originalDate?.getHours() ?? 12, originalDate?.getMinutes() ?? 0, 0, 0);
    }
    if (targetDate.getTime() < Date.now()) {
      toast.error("Escolha um horário no futuro. Para publicar já, use \"Publicar agora\".");
      return;
    }
    const showError = (error: Error) => toast.error(error.message);
    if (dragged.status && RESCHEDULABLE_STATUSES.includes(dragged.status)) {
      schedulePost.mutate(
        { postId: dragged.postId, scheduledAt: targetDate, scope: dragged.isGroup ? "group" : "post" },
        { onSuccess: ({ scheduledCount }) => toast.success(scheduledCount > 1 ? `Programado em ${scheduledCount} contas.` : "Post programado."), onError: showError },
      );
      return;
    }
    // Rascunho ganha horário pretendido; só programa de verdade depois de aprovado (spec 0058, RF-5).
    updatePost.mutate(
      { postId: dragged.postId, scheduledAt: targetDate.toISOString() },
      { onSuccess: () => toast.success("Horário definido. Envie para aprovação para programar."), onError: showError },
    );
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-3 p-3 md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="flex [scrollbar-width:none] w-full max-w-max overflow-x-auto rounded-full border border-line bg-card p-1 [&::-webkit-scrollbar]:hidden">
            {PLANNER_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => showTab(tab)}
                className={cn("flex-none rounded-full px-4 py-1.5 text-sm whitespace-nowrap", searchState.tab === tab ? "bg-foreground font-semibold text-background" : "text-muted-foreground hover:text-foreground")}
              >
                {TAB_LABEL[tab]}
              </button>
            ))}
          </nav>
          {searchState.tab === "kit" && (
            <ClientSelect
              clients={clients}
              className="bg-card sm:w-72"
              selectedOrganizationId={brandKitOrganizationId}
              onSelect={(organizationId) => void setSearchState({ org: organizationId })}
            />
          )}
        </div>

        {searchState.tab === "dashboard" && (
          <PlannerDashboard organizationIds={organizationIds} clients={clients} onOpenPost={openPost} onCreate={setComposerRequest} onNavigate={navigateFromDashboard} />
        )}

        {searchState.tab === "calendar" && (
          <div data-guide={GUIDE_ANCHORS.plannerCalendar.id} className="min-w-0 overflow-hidden rounded-[20px] bg-card">
            <CalendarToolbar
              view={searchState.view}
              anchorDate={anchorDate}
              clients={clients}
              selectedClientIds={searchState.orgs}
              selectedAccountIds={searchState.contas}
              onAccountIdsChange={(contas) => void setSearchState({ contas })}
              selectedTypes={searchState.types}
              selectedStatuses={searchState.status}
              origin={searchState.origin}
              onOriginChange={(origin) => void setSearchState({ origin })}
              onImportCreation={() => setIsImportCreationOpen(true)}
              periodContents={posts}
              onOpenPost={openPost}
              onImportWeeklyScript={() => setIsWeeklyScriptOpen(true)}
              onViewChange={(view) => void setSearchState({ view })}
              onAnchorDateChange={(date) => void setSearchState({ date })}
              onClientIdsChange={(orgs) => void setSearchState({ orgs, contas: [] })}
              onTypesChange={(types) => void setSearchState({ types })}
              onStatusesChange={(status) => void setSearchState({ status })}
              onCreate={(type) => openCreate(type)}
              onCreateBroadcast={() => setIsBroadcastComposerOpen(true)}
            />
            {isKanban ? (
              <KanbanView
                organizationIds={organizationIds}
                types={searchState.types.length ? searchState.types : undefined}
                origin={searchState.origin}
                focusColumn={searchState.column}
                clients={clients}
                onOpenPost={openPost}
                onRetryPost={retryPost}
              />
            ) : searchState.view === "script" ? (
              <ScriptTableView
                weekStart={range.from}
                posts={posts}
                clients={clients}
                weekdayThemes={weekdayThemes}
                themeClient={themeClient}
                onOpenPost={openPost}
                onCreateForDay={(day) => openCreate("STATIC", new Date(day.getFullYear(), day.getMonth(), day.getDate(), 18))}
              />
            ) : (
              <>
                <div className="max-md:hidden">
                  {searchState.view === "week" ? (
                    <WeekView themeClient={themeClient} weekdayThemes={weekdayThemes} weekStart={range.from} posts={posts} broadcasts={broadcasts} slots={slots} clients={clients} onOpenPost={openPost} onRetryPost={retryPost} onUseSlot={programSlot} />
                  ) : (
                    <MonthView
                      rangeStart={range.from}
                      rangeEnd={range.to}
                      anchorDate={anchorDate}
                      posts={posts}
                      broadcasts={broadcasts}
                      clients={clients}
                      onOpenPost={openPost}
                      onRetryPost={retryPost}
                      onShowDay={(day) => void setSearchState({ view: "week", date: day })}
                    />
                  )}
                </div>
                <div className="md:hidden">
                  <MobileAgenda themeClient={themeClient} weekdayThemes={weekdayThemes} posts={posts} slots={slots} clients={clients} onOpenPost={openPost} onRetryPost={retryPost} onUseSlot={programSlot} />
                </div>
              </>
            )}
          </div>
        )}

        {searchState.tab === "campaigns" && <ClientWorkspaceTab clients={clients}>{(plannerId) => <CampaignsTab plannerId={plannerId} />}</ClientWorkspaceTab>}
        {searchState.tab === "mindmaps" && <ClientWorkspaceTab clients={clients}>{(plannerId) => <MindMapsTab plannerId={plannerId} />}</ClientWorkspaceTab>}
        {searchState.tab === "kit" && <BrandKitPage organizationId={brandKitOrganizationId} />}
      </div>
      <PostComposer request={activeComposerRequest} clients={clients} onClose={closeComposer} />
      <BroadcastComposer isOpen={isBroadcastComposerOpen} clients={clients} onClose={() => setIsBroadcastComposerOpen(false)} />
      <ImportWeeklyScriptDialog isOpen={isWeeklyScriptOpen} clients={clients} anchorDate={anchorDate} defaultOrganizationId={themeClient?.id} onClose={() => setIsWeeklyScriptOpen(false)} />
      <ImportCreationDialog isOpen={isImportCreationOpen} clients={clients} onClose={() => setIsImportCreationOpen(false)} />
    </DndContext>
  );
}
