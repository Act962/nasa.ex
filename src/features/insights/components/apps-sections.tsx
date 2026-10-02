"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useOrgRole } from "@/hooks/use-org-role";
import { cn } from "@/lib/utils";
import { GripVerticalIcon, XIcon } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppModule } from "@/features/insights/types";
import { useDashboardStore } from "../hooks/use-dashboard-store";
import { useOrgLayout } from "@/features/insights/context/org-layout-provider";
import {
  METRIC_CATALOG,
  SECTION_META,
  getDefaultVisibleKeys,
  resolveDataPath,
  formatMetricValue,
  toRankingItems,
  type MetricDef,
  type MetricFormat,
} from "@/features/insights/lib/insights-metric-catalog";
import type { InsightBlock } from "@/features/insights/lib/app-metrics";
import {
  LeadsByMetricDialog,
  type LeadMetricApp,
  type LeadMetricKey,
} from "./leads-by-metric-dialog";
import { AddSectionInsightButton } from "./add-section-insight-button";
import { AppChart } from "./app-chart";
import { KpiCardShell } from "./kpi-card-shell";
import { KpiCardStyleMenu } from "./kpi-card-style-menu";
import type { KpiCardStyle } from "@/features/insights/lib/kpi-card-style";

// ─── Mapas de leadMetric pra cada (appModule, key) ──────────────────────────
// Quando preenchido, o card vira clicável e abre o popup de leads.
const LEAD_METRIC_MAP: Partial<
  Record<AppModule, Partial<Record<string, { app: LeadMetricApp; metric: LeadMetricKey }>>>
> = {
  forge: {
    totalProposals: { app: "forge", metric: "forge.totalProposals" },
    pagas: { app: "forge", metric: "forge.pagas" },
    revenueTotal: { app: "forge", metric: "forge.pagas" },
    revenuePipeline: { app: "forge", metric: "forge.enviadas" },
    enviadas: { app: "forge", metric: "forge.enviadas" },
    visualizadas: { app: "forge", metric: "forge.visualizadas" },
    expiradas: { app: "forge", metric: "forge.expiradas" },
    canceladas: { app: "forge", metric: "forge.canceladas" },
  },
  spacetime: {
    total: { app: "spacetime", metric: "spacetime.total" },
    done: { app: "spacetime", metric: "spacetime.done" },
    confirmed: { app: "spacetime", metric: "spacetime.confirmed" },
    pending: { app: "spacetime", metric: "spacetime.pending" },
    cancelled: { app: "spacetime", metric: "spacetime.cancelled" },
    noShow: { app: "spacetime", metric: "spacetime.noShow" },
    withLead: { app: "spacetime", metric: "spacetime.withLead" },
  },
};

// ─── Shared KPI Card ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  sub?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  leadMetric?: { app: LeadMetricApp; metric: LeadMetricKey };
  /**
   * Quando preenchido E o usuário tem permissão de editar layout, mostra
   * um X de "ocultar" no canto do card (visível no hover).
   */
  onHide?: () => void;
  canEdit?: boolean;
  /**
   * Conteúdo customizado pra substituir o número (ex: ranking de users
   * pro KPI `topFastestCreator`).
   */
  children?: React.ReactNode;
  cardStyle?: KpiCardStyle;
  onStyleChange?: (cardStyle: KpiCardStyle) => void;
  onApplyStyleToAll?: (patch: KpiCardStyle) => void;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  sub,
  badge,
  badgeVariant,
  leadMetric,
  onHide,
  canEdit,
  children,
  cardStyle,
  onStyleChange,
  onApplyStyleToAll,
}: KpiCardProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const clickable = !!leadMetric;

  const hideButton =
    onHide && canEdit ? (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              aria-label={`Ocultar ${label}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="size-6 rounded-md flex items-center justify-center text-muted-foreground bg-background/80 backdrop-blur-sm border opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-opacity"
            >
              <XIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Ocultar este indicador</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null;

  const styleMenu =
    canEdit && onStyleChange && onApplyStyleToAll ? (
      <KpiCardStyleMenu label={label} cardStyle={cardStyle} onChange={onStyleChange} onApplyToAll={onApplyStyleToAll} />
    ) : null;

  const card = (
    <KpiCardShell
      label={label}
      value={value}
      sub={sub}
      icon={Icon}
      iconColor={color}
      iconBg={bg}
      badge={badge ? <Badge variant={badgeVariant ?? "secondary"} className="text-[10px]">{badge}</Badge> : undefined}
      cardStyle={cardStyle}
      actions={styleMenu || hideButton ? <>{styleMenu}{hideButton}</> : undefined}
      className={cn(clickable && "cursor-pointer hover:border-foreground/30 hover:shadow-sm transition-all")}
    >
      {children}
    </KpiCardShell>
  );

  if (!clickable) return card;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setPopupOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setPopupOpen(true);
        }}
        className="h-full w-full text-left"
      >
        {card}
      </div>
      <LeadsByMetricDialog
        open={popupOpen}
        onOpenChange={setPopupOpen}
        app={leadMetric.app}
        metric={leadMetric.metric}
        title={label}
      />
    </>
  );
}

// ─── Section Header com slot pra "+ Adicionar Insight" ──────────────────────

function SectionHeader({
  appModule,
}: {
  appModule: AppModule;
}) {
  const meta = SECTION_META[appModule];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", meta.bg)}>
        <Icon className={cn("size-5", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold">{meta.label}</h3>
        {meta.description && (
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        )}
      </div>
      <AddSectionInsightButton appModule={appModule} />
    </div>
  );
}

// ─── Conteúdo customizado pro KPI "topFastestCreator" ───────────────────────

function TopFastestCreatorContent({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") {
    return <p className="text-sm text-muted-foreground">Sem dados suficientes</p>;
  }
  const v = value as { id: string; name: string; avgHours: number; count: number };
  const initial = v.name?.[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        <AvatarImage src={undefined} alt={v.name} />
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{v.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Média {formatMetricValue(v.avgHours, "duration")} · {v.count} ações
        </p>
      </div>
    </div>
  );
}

// ─── Conteúdo customizado pra rankings (top atendentes / tempo por status) ──

function RankingListContent({
  value,
  format,
  labelKey,
  metricKey,
  metricFormatter,
  emptyLabel,
}: {
  value: unknown;
  format: Exclude<MetricFormat, "ranking">;
  labelKey: string; // ex: "name" ou "statusId"
  metricKey: string; // ex: "avgHours" ou "rate"
  metricFormatter?: (n: number) => string;
  emptyLabel: string;
}) {
  if (!Array.isArray(value) || value.length === 0) {
    return (
      <>
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </>
    );
  }
  const items = value.slice(0, 5) as Array<Record<string, unknown>>;
  return (
    <div className="space-y-1.5 -mt-1">
      {items.map((item, idx) => {
        const label = (item[labelKey] ?? item["name"]) as string;
        const metricRaw = item[metricKey] as number;
        const formatted = metricFormatter
          ? metricFormatter(metricRaw)
          : formatMetricValue(metricRaw, format);
        return (
          <div key={idx} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">
              {idx + 1}. {label}
            </span>
            <span className="text-muted-foreground tabular-nums shrink-0">
              {formatted}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Âncora da seção de cada App — as pílulas do seletor rolam até ela. */
export function appSectionElementId(appModule: AppModule): string {
  return `insights-app-${appModule}`;
}

// ─── DynamicSection ─────────────────────────────────────────────────────────

interface DynamicSectionProps {
  appModule: AppModule;
  /** Payload completo retornado por `getAppsInsights` (e opcionalmente
   *  inclui `summary` + `trackingPerformance` pro app tracking). */
  data: Record<string, unknown> | null | undefined;
}

/**
 * Renderiza a seção de um app no dashboard de Insights de forma
 * data-driven: lê do `OrgLayoutProvider` quais KPIs estão visíveis
 * (`section-prefs` block) e mapeia cada um para um `<KpiCard>`.
 *
 * Quando não há `section-prefs` pra esse app, usa `defaultVisible`
 * do catálogo como fallback — preserva o comportamento original.
 */
export function DynamicSection({ appModule, data }: DynamicSectionProps) {
  const { blocks, canEdit, addBlock, updateBlock } = useOrgLayout();

  // Acha o block de prefs pra esse app
  const prefsBlock = useMemo(() => {
    return blocks.find(
      (b): b is Extract<InsightBlock, { type: "section-prefs" }> =>
        b.type === "section-prefs" && b.appModule === appModule,
    );
  }, [blocks, appModule]);

  const visibleKeys = useMemo(() => {
    if (prefsBlock) return prefsBlock.visibleKeys;
    return getDefaultVisibleKeys(appModule);
  }, [prefsBlock, appModule]);

  const visibleMetrics: MetricDef[] = useMemo(() => {
    const all = METRIC_CATALOG.filter((m) => m.appModule === appModule);
    return visibleKeys
      .map((k) => all.find((m) => m.key === k))
      .filter((m): m is MetricDef => !!m);
  }, [visibleKeys, appModule]);

  const cardStyles = prefsBlock?.cardStyles ?? {};

  const persistSectionPrefs = (patch: { visibleKeys?: string[]; cardStyles?: Record<string, KpiCardStyle> }) => {
    if (prefsBlock) {
      updateBlock(prefsBlock.id, patch);
      return;
    }
    addBlock({
      id: `section-prefs-${appModule}-${crypto.randomUUID()}`,
      type: "section-prefs",
      order: blocks.length,
      appModule,
      visibleKeys,
      ...patch,
    });
  };

  const persistVisibleKeys = (nextKeys: string[]) => persistSectionPrefs({ visibleKeys: nextKeys });
  const persistCardStyles = (nextCardStyles: Record<string, KpiCardStyle>) => persistSectionPrefs({ cardStyles: nextCardStyles });

  const handleStyleChange = (metricKey: string, cardStyle: KpiCardStyle) => {
    persistCardStyles({ ...cardStyles, [metricKey]: cardStyle });
  };

  const handleApplyStyleToAll = (patch: KpiCardStyle) => {
    const nextCardStyles = Object.fromEntries(
      visibleKeys.map((visibleKey) => [visibleKey, { ...cardStyles[visibleKey], ...patch }]),
    );
    persistCardStyles({ ...cardStyles, ...nextCardStyles });
  };

  const handleHide = (metricKey: string) => {
    persistVisibleKeys(visibleKeys.filter((visibleKey) => visibleKey !== metricKey));
  };

  // Arrastar só começa depois de 6px: um clique simples continua abrindo o detalhe do cartão.
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const orderedKeys = visibleMetrics.map((metric) => metric.key);
    const fromIndex = orderedKeys.indexOf(String(active.id));
    const toIndex = orderedKeys.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;
    persistVisibleKeys(arrayMove(orderedKeys, fromIndex, toIndex));
  };

  if (visibleMetrics.length === 0) {
    // Mostra header com botão de adicionar mesmo sem KPIs visíveis
    return (
      <div id={appSectionElementId(appModule)} className="scroll-mt-20 space-y-3">
        <SectionHeader appModule={appModule} />
        <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm font-medium">Nenhum indicador selecionado</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canEdit
              ? 'Clique em "Adicionar Insight" pra escolher os KPIs desta seção.'
              : "Peça pro administrador da empresa habilitar indicadores nesta seção."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id={appSectionElementId(appModule)} className="scroll-mt-20 space-y-3">
      <SectionHeader appModule={appModule} />
      <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={visibleMetrics.map((metric) => metric.key)} strategy={rectSortingStrategy}>
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleMetrics.map((metric) => {
          const rawValue = resolveDataPath(data, metric.dataPath);
          const leadMetric =
            LEAD_METRIC_MAP[appModule]?.[metric.key] ?? undefined;

          // Conteúdo customizado pra KPIs especiais (ranking, etc.)
          let customChildren: React.ReactNode | undefined;
          if (metric.format === "ranking" && metric.ranking) {
            customChildren = (
              <RankingListContent
                value={toRankingItems(rawValue)}
                format={metric.ranking.valueFormat}
                labelKey={metric.ranking.labelKey}
                metricKey={metric.ranking.valueKey}
                emptyLabel="Sem dados no período"
              />
            );
          } else if (metric.key === "topFastestCreator" && appModule === "workspace") {
            customChildren = <TopFastestCreatorContent value={rawValue} />;
          } else if (
            appModule === "tracking" &&
            metric.key === "avgTimePerStatus"
          ) {
            customChildren = (
              <RankingListContent
                value={rawValue}
                format="duration"
                labelKey="name"
                metricKey="avgHours"
                emptyLabel="Sem dados ainda"
              />
            );
          } else if (
            appModule === "tracking" &&
            metric.key === "avgFirstResponseByAttendant"
          ) {
            customChildren = (
              <RankingListContent
                value={rawValue}
                format="duration"
                labelKey="name"
                metricKey="avgHours"
                emptyLabel="Sem dados ainda"
              />
            );
          } else if (
            appModule === "tracking" &&
            metric.key === "conversionRateByAttendant"
          ) {
            customChildren = (
              <RankingListContent
                value={rawValue}
                format="percent"
                labelKey="name"
                metricKey="rate"
                emptyLabel="Sem dados ainda"
              />
            );
          }

          return (
            <SortableKpiItem key={metric.key} metricKey={metric.key} isDraggable={canEdit}>
            <KpiCard
              label={metric.label}
              value={formatMetricValue(rawValue, metric.format)}
              icon={metric.icon}
              color={metric.color}
              bg={metric.bg}
              sub={metric.description}
              leadMetric={leadMetric}
              onHide={() => handleHide(metric.key)}
              canEdit={canEdit}
              cardStyle={cardStyles[metric.key]}
              onStyleChange={(cardStyle) => handleStyleChange(metric.key, cardStyle)}
              onApplyStyleToAll={handleApplyStyleToAll}
            >
              {customChildren}
            </KpiCard>
            </SortableKpiItem>
          );
        })}
      </div>
      </SortableContext>
      </DndContext>
      <AppChart appModule={appModule} />
    </div>
  );
}

/** Cartão arrastável: a ordem vira a ordem de `visibleKeys` da seção (salva no layout da empresa). */
function SortableKpiItem({
  metricKey,
  isDraggable,
  children,
}: {
  metricKey: string;
  isDraggable: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: metricKey,
    disabled: !isDraggable,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/sortable relative h-full", isDragging && "z-10 opacity-80")}
      {...attributes}
      {...listeners}
    >
      {children}
      {isDraggable && (
        <GripVerticalIcon
          aria-hidden
          className="pointer-events-none absolute bottom-2 right-2 size-3.5 text-muted-foreground/0 transition-colors group-hover/sortable:text-muted-foreground/60"
        />
      )}
    </div>
  );
}

// ─── Tracking Performance loader — chamado sob demanda quando algum KPI
//     de tracking-performance está visível ───────────────────────────────────

const TRACKING_PERF_KEYS = new Set([
  "avgTimePerStatus",
  "avgFirstResponseByAttendant",
  "conversionRateByAttendant",
]);

interface TrackingDynamicSectionProps {
  /** Mesma estrutura de DashboardSummary que vem do tracking-dashboard. */
  summary: object | undefined;
  /** Indicadores extras do Tracking vindos de `getAppsInsights` (conversão, valores, origem, perdas). */
  extras?: object;
}

/**
 * Wrapper específico pro app `tracking` — chama `getTrackingPerformance`
 * sob demanda apenas quando o usuário tem pelo menos 1 KPI de
 * performance ativado.
 */
export function TrackingDynamicSection({ summary, extras }: TrackingDynamicSectionProps) {
  const { blocks } = useOrgLayout();
  const { organizationIds, dateRange, trackingId } = useDashboardStore();
  const { isSingle } = useOrgRole();

  const prefs = blocks.find(
    (b): b is Extract<InsightBlock, { type: "section-prefs" }> =>
      b.type === "section-prefs" && b.appModule === "tracking",
  );
  const visibleKeys = prefs ? prefs.visibleKeys : getDefaultVisibleKeys("tracking");
  const needsPerformance = visibleKeys.some((k) => TRACKING_PERF_KEYS.has(k));

  // Single (member comum) não roda query pesada — vê só os dados base.
  const enabled = needsPerformance && !isSingle;

  const { data: perf } = useQuery({
    ...orpc.insights.getTrackingPerformance.queryOptions({
      input: {
        organizationIds: organizationIds.length > 0 ? organizationIds : undefined,
        trackingId: trackingId || undefined,
        startDate: dateRange.from?.toISOString(),
        endDate: dateRange.to?.toISOString(),
      },
    }),
    enabled,
    staleTime: 60_000,
  });

  const data = useMemo(
    () => ({ summary, trackingPerformance: perf, tracking: extras }),
    [summary, perf, extras],
  );

  return <DynamicSection appModule="tracking" data={data} />;
}

// ─── Wrappers de compat — preservam API dos chamadores existentes ──────────
// Cada wrapper aceita a mesma prop `data` que tinha antes e injeta no
// `DynamicSection` no envelope esperado pelo catálogo (`{appKey: data}`).

interface ForgeData { totalProposals: number; rascunho: number; enviadas: number; visualizadas: number; pagas: number; expiradas: number; canceladas: number; revenueTotal: number; revenuePipeline: number; totalContracts: number; contractsAtivo: number; }
export function ForgeSection({ data }: { data: ForgeData & Record<string, unknown> }) {
  return <DynamicSection appModule="forge" data={{ forge: data }} />;
}

interface SpacetimeData { total: number; pending: number; confirmed: number; done: number; cancelled: number; noShow: number; withLead: number; conversionRate: number; }
export function SpacetimeSection({ data }: { data: SpacetimeData & Record<string, unknown> }) {
  return <DynamicSection appModule="spacetime" data={{ spacetime: data }} />;
}

interface NasaPlannerData { total: number; draft: number; published: number; scheduled: number; approved: number; starsSpent: number; byNetwork: Record<string, number>; }
export function NasaPlannerSection({ data }: { data: NasaPlannerData & Record<string, unknown> }) {
  return <DynamicSection appModule="nasa-planner" data={{ nasaPlanner: data }} />;
}

interface IntegrationsProps {
  // `data` aceita o shape rico vindo de `getMetaInsights` (que pode ter
  // diversos campos extras). O catálogo só lê spend/leads/clicks/etc.
  metaAds?: { connected?: boolean; data?: Record<string, unknown> | null } | null;
}
export function IntegrationsSection({ metaAds }: IntegrationsProps) {
  // Mapeia o payload de meta pro formato esperado pelo catálogo
  const data = metaAds?.connected && metaAds.data ? metaAds.data : {};
  return <DynamicSection appModule="integrations" data={{ metaAds: data }} />;
}

interface WorkspaceData { total: number; done: number; open: number; overdue: number; byType: Record<string, number>; topCreators: Array<{ id: string; name: string; image: string | null; count: number }>; }
export function WorkspaceSection({ data }: { data: WorkspaceData & Record<string, unknown> }) {
  return <DynamicSection appModule="workspace" data={{ workspace: data }} />;
}

interface FormsData { totalForms: number; publishedForms: number; totalResponses: number; responsesWithLead: number; totalViews: number; topForms: Array<{ id: string; name: string; responses: number }>; }
export function FormsSection({ data }: { data: FormsData & Record<string, unknown> }) {
  return <DynamicSection appModule="forms" data={{ forms: data }} />;
}

interface NBoxData { totalItems: number; publicItems: number; totalSize: number; byType: Record<string, number>; }
export function NBoxSection({ data }: { data: NBoxData & Record<string, unknown> }) {
  return <DynamicSection appModule="nbox" data={{ nbox: data }} />;
}

interface PaymentData { totalEntries: number; revenue: number; expense: number; pendingCount: number; pendingAmount: number; overdueCount: number; overdueAmount: number; avgTicket: number; }
export function PaymentSection({ data }: { data: PaymentData & Record<string, unknown> }) {
  return <DynamicSection appModule="payment" data={{ payment: data }} />;
}

interface LinnkerData { totalScans: number; scansWithLead: number; totalClicks: number; topLinks: Array<{ id: string; title: string; clicks: number }>; }
export function LinnkerSection({ data }: { data: LinnkerData & Record<string, unknown> }) {
  return <DynamicSection appModule="linnker" data={{ linnker: data }} />;
}

interface SpacePointsData { totalBalance: number; weeklyBalance: number; granted: number; spent: number; activeUsers: number; totalUsers: number; }
export function SpacePointsSection({ data }: { data: SpacePointsData & Record<string, unknown> }) {
  return <DynamicSection appModule="space-points" data={{ spacePoints: data }} />;
}

interface StarsData { lastBalance: number; topupTotal: number; appCharges: number; planCredit: number; byApp: Record<string, number>; }
export function StarsSection({ data }: { data: StarsData & Record<string, unknown> }) {
  return <DynamicSection appModule="stars" data={{ stars: data }} />;
}

interface SpaceStationData { totalStations: number; publicStations: number; orgStations: number; userStations: number; totalStarsReceived: number; starsSentInPeriod: number; starsReceivedInPeriod: number; pendingAccessRequests: number; approvedAccessRequests: number; }
export function SpaceStationSection({ data }: { data: SpaceStationData & Record<string, unknown> }) {
  // Map keys to catalog: catalog uses stations/publicStations/starsSent/starsReceived
  const mapped = {
    stations: data.totalStations,
    publicStations: data.publicStations,
    starsSent: data.starsSentInPeriod,
    starsReceived: data.starsReceivedInPeriod,
    pendingAccessRequests: data.pendingAccessRequests,
    approvedAccessRequests: data.approvedAccessRequests,
  };
  return <DynamicSection appModule="space-station" data={{ spaceStation: mapped }} />;
}

interface NasaRouteData { totalCourses: number; publishedCourses: number; totalStudents: number; totalEnrollments: number; paidEnrollments: number; freeEnrollments: number; starsRevenue: number; completedCourses: number; completedLessons: number; certificatesIssued: number; topCourses: Array<{ id: string; title: string; enrollments: number }>; }
export function NasaRouteSection({ data }: { data: NasaRouteData & Record<string, unknown> }) {
  // Map keys to catalog
  const mapped = {
    courses: data.totalCourses,
    students: data.totalStudents,
    enrollmentsPaid: data.paidEnrollments,
    revenueStars: data.starsRevenue,
    completed: data.completedCourses,
    certificates: data.certificatesIssued,
    completionRate: data.completionRate,
    avgTimeToCertificate: data.avgTimeToCertificate,
    topCourses: data.topCourses,
    completedLessons: data.completedLessons,
    freeEnrollments: data.freeEnrollments,
    revenueBrl: data.revenueBrl,
  };
  return <DynamicSection appModule="nasa-route" data={{ nasaRoute: mapped }} />;
}

interface CampanhasData { totalCampaigns: number; sentCampaigns: number; totalRecipients: number; sentCount: number; deliveredCount: number; readCount: number; failedCount: number; deliveryRate: number; readRate: number; }
export function CampanhasSection({ data }: { data: CampanhasData & Record<string, unknown> }) {
  return <DynamicSection appModule="campanhas" data={{ campanhas: data }} />;
}

interface TrafegoData { totalOrders: number; activeOrders: number; adBudget: number; serviceFees: number; revenue: number; }
export function TrafegoSection({ data }: { data: TrafegoData & Record<string, unknown> }) {
  return <DynamicSection appModule="trafego" data={{ trafego: data }} />;
}

interface NerpData { totalOrders: number; paidOrders: number; canceledOrders: number; paidRevenue: number; avgTicket: number; conversionRate: number; }
export function NerpSection({ data }: { data: NerpData & Record<string, unknown> }) {
  return <DynamicSection appModule="nerp" data={{ nerp: data }} />;
}

interface StarFriendsData { totalMembers: number; newMembers: number; starsEarned: number; starsRedeemed: number; starsExpired: number; redemptions: number; }
export function StarFriendsSection({ data }: { data: StarFriendsData & Record<string, unknown> }) {
  return <DynamicSection appModule="star-friends" data={{ starFriends: data }} />;
}
