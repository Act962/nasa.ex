import type { AppModule } from "@/features/insights/types";

export type AppMetricSource =
  | "tracking"
  | "chat"
  | "workspace"
  | "spacetime"
  | "nasa-route"
  | "payment"
  | "forge";

export interface AppMetricDef {
  key: string;
  label: string;
  unit?: "count" | "percent" | "currency";
  description?: string;
}

export const APP_METRIC_SOURCES: AppMetricSource[] = [
  "tracking",
  "chat",
  "workspace",
  "spacetime",
  "nasa-route",
  "payment",
  "forge",
];

export const APP_METRICS: Record<AppMetricSource, AppMetricDef[]> = {
  tracking: [
    { key: "leads.total", label: "Total de leads", unit: "count" },
    { key: "leads.won", label: "Leads ganhos", unit: "count" },
    {
      key: "leads.conversion-rate",
      label: "Taxa de conversão",
      unit: "percent",
    },
  ],
  chat: [
    { key: "conversations.total", label: "Total de conversas", unit: "count" },
    {
      key: "conversations.unread",
      label: "Conversas não lidas",
      unit: "count",
    },
    { key: "messages.sent", label: "Mensagens enviadas", unit: "count" },
  ],
  workspace: [
    { key: "actions.total", label: "Total de ações", unit: "count" },
    { key: "actions.completed", label: "Ações concluídas", unit: "count" },
    { key: "actions.overdue", label: "Ações atrasadas", unit: "count" },
  ],
  spacetime: [
    { key: "events.total", label: "Eventos no período", unit: "count" },
    { key: "events.upcoming", label: "Próximos eventos", unit: "count" },
  ],
  "nasa-route": [
    { key: "courses.published", label: "Cursos publicados", unit: "count" },
    { key: "lessons.completed", label: "Aulas concluídas", unit: "count" },
    { key: "students.active", label: "Alunos ativos", unit: "count" },
  ],
  payment: [
    {
      key: "charges.total",
      label: "Cobranças no período",
      unit: "count",
    },
    { key: "charges.paid", label: "Cobranças pagas", unit: "count" },
    {
      key: "revenue.gross",
      label: "Faturamento bruto",
      unit: "currency",
    },
  ],
  forge: [
    {
      key: "proposals.total",
      label: "Propostas no período",
      unit: "count",
    },
    { key: "proposals.paid", label: "Propostas pagas", unit: "count" },
    {
      key: "revenue.closed",
      label: "Receita fechada (Forge)",
      unit: "currency",
    },
  ],
};

export const APP_METRIC_LABELS: Record<AppMetricSource, string> = {
  tracking: "Tracking",
  chat: "Chat",
  workspace: "Workspace",
  spacetime: "SpaceTime",
  "nasa-route": "NASA Route",
  payment: "NASA Payment",
  forge: "Forge",
};

export function isAppMetricSource(slug: string): slug is AppMetricSource {
  return (APP_METRIC_SOURCES as string[]).includes(slug);
}

export function findMetricDef(
  appSlug: AppMetricSource,
  metricKey: string,
): AppMetricDef | undefined {
  return APP_METRICS[appSlug]?.find((m) => m.key === metricKey);
}

export type InsightBlockType =
  | "section"
  | "tag-tile"
  | "app-metric"
  | "custom-chart"
  | "add-anchor";

export interface InsightBlockBase {
  id: string;
  type: InsightBlockType;
  order: number;
  pinnedToApps?: AppModule[];
}

export interface InsightBlockSection extends InsightBlockBase {
  type: "section";
  appModule: AppModule;
}

export interface InsightBlockTagTile extends InsightBlockBase {
  type: "tag-tile";
  tagId: string;
  title?: string;
}

export interface InsightBlockAppMetric extends InsightBlockBase {
  type: "app-metric";
  appSlug: AppMetricSource;
  metricKey: string;
  label?: string;
}

export interface InsightBlockCustomChart extends InsightBlockBase {
  type: "custom-chart";
  chartId: string;
}

export interface InsightBlockAddAnchor extends InsightBlockBase {
  type: "add-anchor";
}

export type InsightBlock =
  | InsightBlockSection
  | InsightBlockTagTile
  | InsightBlockAppMetric
  | InsightBlockCustomChart
  | InsightBlockAddAnchor;
