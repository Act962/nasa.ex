import type { AppModule } from "@/features/insights/types";

/**
 * Séries do Gráfico Cruzado e os filtros que cada uma aceita. Compartilhado entre a tela e o
 * servidor: a tela mostra só os filtros da série escolhida; o servidor ignora filtro que a série não usa.
 */

export type CrossAxis = "period" | "attendant" | "source" | "loss";

export type CrossFilterKey =
  | "tracking"
  | "tag"
  | "status"
  | "attendant"
  | "workspace"
  | "paymentAccount"
  | "paymentCategory";

export type CrossBucket = "auto" | "day" | "week" | "month";

export interface CrossDatasetDef {
  id: string;
  appModule: AppModule;
  axis: CrossAxis;
  label: string;
  shortLabel: string;
  /** Filtros próprios da série, além de período e empresa (que valem para todas). */
  filters: CrossFilterKey[];
}

export interface CrossSeriesFilters {
  startDate?: string;
  endDate?: string;
  organizationIds?: string[];
  trackingIds?: string[];
  tagIds?: string[];
  statusIds?: string[];
  memberIds?: string[];
  workspaceIds?: string[];
  paymentAccountIds?: string[];
  paymentCategoryIds?: string[];
}

export const CROSS_AXIS_LABELS: Record<CrossAxis, string> = {
  period: "Por período",
  attendant: "Por atendente",
  source: "Por origem do lead",
  loss: "Por motivo de perda",
};

export const CROSS_FILTER_LABELS: Record<CrossFilterKey, string> = {
  tracking: "Trackings",
  tag: "Tags",
  status: "Status",
  attendant: "Atendentes",
  workspace: "Workspaces",
  paymentAccount: "Bancos",
  paymentCategory: "Categorias",
};

const LEAD_FILTERS: CrossFilterKey[] = ["tracking", "tag", "status", "attendant"];

export const CROSS_DATASETS: CrossDatasetDef[] = [
  { id: "ts-leads-created", appModule: "tracking", axis: "period", label: "Tracking — Leads criados", shortLabel: "Leads criados", filters: LEAD_FILTERS },
  { id: "ts-leads-won", appModule: "tracking", axis: "period", label: "Tracking — Leads ganhos", shortLabel: "Leads ganhos", filters: LEAD_FILTERS },
  { id: "ts-leads-lost", appModule: "tracking", axis: "period", label: "Tracking — Leads perdidos", shortLabel: "Leads perdidos", filters: LEAD_FILTERS },
  { id: "ts-won-amount", appModule: "tracking", axis: "period", label: "Tracking — Valor ganho (R$)", shortLabel: "Valor ganho", filters: LEAD_FILTERS },
  { id: "ts-messages-in", appModule: "chat", axis: "period", label: "Chat — Mensagens recebidas", shortLabel: "Msg recebidas", filters: ["tracking", "tag", "attendant"] },
  { id: "ts-messages-out", appModule: "chat", axis: "period", label: "Chat — Mensagens enviadas", shortLabel: "Msg enviadas", filters: ["tracking", "tag", "attendant"] },
  { id: "ts-proposals-created", appModule: "forge", axis: "period", label: "Forge — Propostas criadas", shortLabel: "Propostas", filters: ["attendant"] },
  { id: "ts-proposals-paid", appModule: "forge", axis: "period", label: "Forge — Propostas pagas", shortLabel: "Propostas pagas", filters: ["attendant"] },
  { id: "ts-appointments", appModule: "spacetime", axis: "period", label: "SpaceTime — Agendamentos", shortLabel: "Agendamentos", filters: ["tracking"] },
  { id: "ts-form-responses", appModule: "forms", axis: "period", label: "Formulários — Respostas", shortLabel: "Respostas", filters: [] },
  { id: "ts-revenue", appModule: "payment", axis: "period", label: "Pagamentos — Receita recebida (R$)", shortLabel: "Receita", filters: ["paymentAccount", "paymentCategory"] },
  { id: "ts-expense", appModule: "payment", axis: "period", label: "Pagamentos — Despesa paga (R$)", shortLabel: "Despesa", filters: ["paymentAccount", "paymentCategory"] },
  { id: "ts-campaign-sent", appModule: "campanhas", axis: "period", label: "Campanhas — Mensagens enviadas", shortLabel: "Disparos", filters: ["tracking"] },
  { id: "ts-campaign-read", appModule: "campanhas", axis: "period", label: "Campanhas — Mensagens lidas", shortLabel: "Lidas", filters: ["tracking"] },
  { id: "ts-trafego-budget", appModule: "trafego", axis: "period", label: "trafeGO — Verba contratada (R$)", shortLabel: "Verba", filters: [] },
  { id: "ts-nerp-paid", appModule: "nerp", axis: "period", label: "NERP — Pedidos pagos", shortLabel: "Pedidos pagos", filters: ["tracking", "tag"] },
  { id: "ts-nerp-revenue", appModule: "nerp", axis: "period", label: "NERP — Receita do catálogo (R$)", shortLabel: "Receita catálogo", filters: ["tracking", "tag"] },
  { id: "ts-loyalty-earned", appModule: "star-friends", axis: "period", label: "Star Friends — Estrelas ganhas", shortLabel: "Estrelas ganhas", filters: [] },
  { id: "ts-loyalty-redemptions", appModule: "star-friends", axis: "period", label: "Star Friends — Resgates", shortLabel: "Resgates", filters: [] },
  { id: "ts-actions-done", appModule: "workspace", axis: "period", label: "Workspace — Ações concluídas", shortLabel: "Ações concluídas", filters: ["workspace", "tracking", "attendant"] },
  { id: "ts-linnker-scans", appModule: "linnker", axis: "period", label: "Linnker — Acessos", shortLabel: "Acessos Linnker", filters: [] },
  { id: "ts-posts-published", appModule: "nasa-planner", axis: "period", label: "ÓRBITA Post — Posts publicados", shortLabel: "Posts publicados", filters: [] },
  { id: "ts-stars-consumed", appModule: "stars", axis: "period", label: "Stars — Consumo", shortLabel: "Stars consumidas", filters: [] },
  { id: "dim-attendant-leads", appModule: "tracking", axis: "attendant", label: "Leads", shortLabel: "Leads", filters: ["tracking", "tag", "status"] },
  { id: "dim-attendant-won", appModule: "tracking", axis: "attendant", label: "Leads ganhos", shortLabel: "Ganhos", filters: ["tracking", "tag", "status"] },
  { id: "dim-attendant-won-amount", appModule: "tracking", axis: "attendant", label: "Valor ganho (R$)", shortLabel: "Valor ganho", filters: ["tracking", "tag", "status"] },
  { id: "dim-attendant-conversion", appModule: "tracking", axis: "attendant", label: "Taxa de conversão (%)", shortLabel: "Conversão %", filters: ["tracking", "tag", "status"] },
  { id: "dim-attendant-first-response", appModule: "chat", axis: "attendant", label: "Tempo da 1ª resposta (h)", shortLabel: "1ª resposta (h)", filters: ["tracking", "tag"] },
  { id: "dim-attendant-messages", appModule: "chat", axis: "attendant", label: "Mensagens enviadas", shortLabel: "Mensagens", filters: ["tracking", "tag"] },
  { id: "dim-attendant-paid-proposals", appModule: "forge", axis: "attendant", label: "Propostas pagas", shortLabel: "Propostas pagas", filters: [] },
  { id: "dim-source-leads", appModule: "tracking", axis: "source", label: "Leads", shortLabel: "Leads", filters: LEAD_FILTERS },
  { id: "dim-source-won", appModule: "tracking", axis: "source", label: "Leads ganhos", shortLabel: "Ganhos", filters: LEAD_FILTERS },
  { id: "dim-source-lost", appModule: "tracking", axis: "source", label: "Leads perdidos", shortLabel: "Perdidos", filters: LEAD_FILTERS },
  { id: "dim-source-won-amount", appModule: "tracking", axis: "source", label: "Valor ganho (R$)", shortLabel: "Valor ganho", filters: LEAD_FILTERS },
  { id: "dim-source-ticket", appModule: "tracking", axis: "source", label: "Ticket médio (R$)", shortLabel: "Ticket médio", filters: LEAD_FILTERS },
  { id: "dim-source-conversion", appModule: "tracking", axis: "source", label: "Taxa de conversão (%)", shortLabel: "Conversão %", filters: LEAD_FILTERS },
  { id: "dim-loss-count", appModule: "tracking", axis: "loss", label: "Perdas", shortLabel: "Perdas", filters: LEAD_FILTERS },
  { id: "dim-loss-amount", appModule: "tracking", axis: "loss", label: "Valor perdido (R$)", shortLabel: "Valor perdido", filters: LEAD_FILTERS },
  { id: "dim-loss-share", appModule: "tracking", axis: "loss", label: "% das perdas", shortLabel: "% das perdas", filters: LEAD_FILTERS },
];

export function findCrossDataset(datasetId: string): CrossDatasetDef | undefined {
  return CROSS_DATASETS.find((dataset) => dataset.id === datasetId);
}

export type CrossUnit = "count" | "currency" | "percent" | "hours";

/** Unidade da série (pelo sufixo do rótulo): séries de unidades diferentes ganham eixos Y separados no gráfico. */
export function crossDatasetUnit(datasetId: string): CrossUnit {
  const label = findCrossDataset(datasetId)?.label ?? "";
  if (label.includes("(R$)")) return "currency";
  if (label.includes("(%)") || label.startsWith("% ")) return "percent";
  if (label.includes("(h)")) return "hours";
  return "count";
}

export type CrossSeriesChartType = "bar" | "line" | "area";
export type CrossGlobalChartType = "composed" | "pie" | "bar-h";

/** Configuração do Gráfico Cruzado — guardada para reabrir igual e congelada no relatório salvo. */
export interface CrossChartSeriesConfig {
  id: string;
  datasetId: string;
  chartType: CrossSeriesChartType;
  color: string;
  filters: CrossSeriesFilters;
}

export interface CrossChartConfig {
  series: CrossChartSeriesConfig[];
  globalType: CrossGlobalChartType;
  bucket: CrossBucket;
  alignPeriods: boolean;
}

/** Escolhas do gráfico "Evolução" de um App (eixo, indicadores ligados e tipo). */
export interface AppChartConfig {
  axis: CrossAxis;
  datasetIds: string[];
  chartType: CrossSeriesChartType;
}

export const MAX_CROSS_SERIES = 8;
export const DEFAULT_SERIES_RANGE_DAYS = 30;
