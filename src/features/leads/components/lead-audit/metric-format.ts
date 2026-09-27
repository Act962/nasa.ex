import {
  BarChart3Icon,
  BanIcon,
  ClockIcon,
  FlameIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TargetIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

// Como cada métrica do "Auditar Lead" aparece na tela (spec 0035).

export interface LeadMetricsView {
  purchasePotential: number;
  interestLevel: "LOW" | "MEDIUM" | "HIGH";
  purchasesCount: number;
  interactionsPerMonth: number;
  avgAttendanceSeconds: number | null;
  interactionLossRate: number;
  avgResponseSeconds: number | null;
  qualityScore: number | null;
  resolutionRate: number | null;
  source: "COMPUTED" | "AI";
  aiRationale: string | null;
  computedAt: Date | string;
}

export interface MetricDisplay {
  id: string;
  /** Rótulo curto do cartão, numa linha só. */
  label: string;
  /** Explicação completa, no tooltip. */
  description: string;
  value: string;
  icon: LucideIcon;
  iconClassName: string;
  valueClassName?: string;
}

const INTEREST_LABELS = { LOW: "Baixo", MEDIUM: "Médio", HIGH: "Alto" } as const;
const INTEREST_COLORS = { LOW: "text-red-400", MEDIUM: "text-amber-400", HIGH: "text-emerald-400" } as const;

/** Potencial de compra em cor: 0% vermelho (matiz 0) até 100% verde (matiz 120). */
export function potentialColor(potential: number): string {
  const clamped = Math.min(100, Math.max(0, potential));
  return `hsl(${Math.round((clamped / 100) * 120)} 75% 50%)`;
}

/** 512 s → "08:32"; acima de 1 h, "1h05". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/** Verde bom, âmbar médio, vermelho ruim — em métricas onde maior é melhor. */
function goodScoreColor(value: number | null): string {
  if (value === null) return "";
  if (value >= 70) return "text-emerald-400";
  if (value >= 40) return "text-amber-400";
  return "text-red-400";
}

/** Métricas em que menor é melhor (perda). */
function lowIsGoodColor(value: number): string {
  if (value <= 10) return "text-emerald-400";
  if (value <= 30) return "text-amber-400";
  return "text-red-400";
}

export function behaviorMetrics(metrics: LeadMetricsView): MetricDisplay[] {
  return [
    { id: "potential", label: "Potencial", description: "Potencial de compra (0 a 100%)", value: `${metrics.purchasePotential}%`, icon: BarChart3Icon, iconClassName: goodScoreColor(metrics.purchasePotential), valueClassName: goodScoreColor(metrics.purchasePotential) },
    { id: "interest", label: "Interesse", description: "Nível de interesse do lead", value: INTEREST_LABELS[metrics.interestLevel], icon: FlameIcon, iconClassName: "text-orange-400", valueClassName: INTEREST_COLORS[metrics.interestLevel] },
    { id: "purchases", label: "Compras", description: "Propostas pagas ou negócios ganhos", value: String(metrics.purchasesCount), icon: ShoppingCartIcon, iconClassName: "text-amber-400" },
    { id: "interactions", label: "Interações", description: "Mensagens nos últimos 30 dias", value: `${metrics.interactionsPerMonth}/mês`, icon: MessageSquareIcon, iconClassName: "text-sky-400" },
    { id: "attendance", label: "Atendimento", description: "Tempo médio de atendimento (mm:ss)", value: formatDuration(metrics.avgAttendanceSeconds), icon: ClockIcon, iconClassName: "text-muted-foreground" },
    { id: "loss", label: "Perda", description: "Mensagens do lead sem resposta em 24 h", value: `${metrics.interactionLossRate}%`, icon: BanIcon, iconClassName: "text-red-400", valueClassName: lowIsGoodColor(metrics.interactionLossRate) },
  ];
}

export function serviceMetrics(metrics: LeadMetricsView): MetricDisplay[] {
  return [
    { id: "response", label: "Resposta", description: "Tempo médio da primeira resposta (mm:ss)", value: formatDuration(metrics.avgResponseSeconds), icon: ZapIcon, iconClassName: "text-amber-400" },
    { id: "quality", label: "Qualidade", description: "Respostas dentro do SLA da etapa", value: formatPercent(metrics.qualityScore), icon: ShieldCheckIcon, iconClassName: "text-emerald-400", valueClassName: goodScoreColor(metrics.qualityScore) },
    { id: "resolution", label: "Resolução", description: "Atendimentos encerrados com sucesso", value: formatPercent(metrics.resolutionRate), icon: TargetIcon, iconClassName: "text-emerald-400", valueClassName: goodScoreColor(metrics.resolutionRate) },
  ];
}
