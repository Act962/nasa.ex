/**
 * Catálogo central de KPIs disponíveis no dashboard de Insights.
 *
 * Cada entrada descreve uma métrica que pode aparecer dentro de uma
 * seção de app. `defaultVisible=true` marca o set de KPIs que aparece
 * sem o usuário precisar configurar nada — mantém compat com o
 * dashboard pré-personalização.
 *
 * `dataPath` é o path dentro do payload retornado por
 * `orpc.insights.getAppsInsights` (e — pro app tracking — pelo retorno
 * de `getTrackingPerformance`). O `<DynamicSection>` consulta esse path
 * pra resolver o valor em runtime.
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Download,
  Eye,
  FileText,
  Flame,
  FormInput,
  GraduationCap,
  Inbox,
  Layers,
  Link2,
  ListTodo,
  Map as MapIcon,
  MessageSquare,
  Percent,
  Plug,
  Receipt,
  Rocket,
  Send,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import type { AppModule } from "@/features/insights/types";

export type MetricFormat =
  | "number"
  | "currency"
  | "percent"
  | "duration"
  | "ranking";

export interface MetricDef {
  appModule: AppModule;
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  format: MetricFormat;
  defaultVisible: boolean;
  description?: string;
  /**
   * Caminho dentro do payload de `getAppsInsights` (ou
   * `getTrackingPerformance` pra métricas do app tracking) que resolve
   * o valor da métrica. Suporta segmentos aninhados separados por ".".
   */
  dataPath: string;
}

// ─── Forge ──────────────────────────────────────────────────────────────────

const FORGE: MetricDef[] = [
  { appModule: "forge", key: "totalProposals", label: "Total de propostas", icon: FileText, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/40", format: "number", defaultVisible: true, dataPath: "forge.totalProposals" },
  { appModule: "forge", key: "pagas", label: "Propostas pagas", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "forge.pagas" },
  { appModule: "forge", key: "revenueTotal", label: "Receita fechada", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "currency", defaultVisible: true, description: "Soma das propostas com status PAGA", dataPath: "forge.revenueTotal" },
  { appModule: "forge", key: "revenuePipeline", label: "Pipeline em aberto", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40", format: "currency", defaultVisible: true, description: "Enviadas + Visualizadas", dataPath: "forge.revenuePipeline" },
  { appModule: "forge", key: "enviadas", label: "Enviadas", icon: FileText, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "forge.enviadas" },
  { appModule: "forge", key: "visualizadas", label: "Visualizadas", icon: Eye, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/40", format: "number", defaultVisible: true, dataPath: "forge.visualizadas" },
  { appModule: "forge", key: "expiradas", label: "Expiradas", icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40", format: "number", defaultVisible: true, dataPath: "forge.expiradas" },
  { appModule: "forge", key: "canceladas", label: "Canceladas", icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/40", format: "number", defaultVisible: true, dataPath: "forge.canceladas" },
  // Novos
  { appModule: "forge", key: "avgTimeToPaid", label: "Tempo médio até pagamento", icon: Timer, color: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "duration", defaultVisible: false, description: "Média de horas entre criação e status PAGA", dataPath: "forge.avgTimeToPaid" },
  { appModule: "forge", key: "avgDiscount", label: "Desconto médio", icon: Percent, color: "text-amber-700", bg: "bg-amber-50 dark:bg-amber-950/40", format: "percent", defaultVisible: false, description: "Desconto médio aplicado nas propostas", dataPath: "forge.avgDiscount" },
  { appModule: "forge", key: "lostRevenue", label: "Receita perdida", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/40", format: "currency", defaultVisible: false, description: "Soma de propostas canceladas + expiradas", dataPath: "forge.lostRevenue" },
];

// ─── SpaceTime ──────────────────────────────────────────────────────────────

const SPACETIME: MetricDef[] = [
  { appModule: "spacetime", key: "total", label: "Total de agendamentos", icon: Calendar, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "spacetime.total" },
  { appModule: "spacetime", key: "done", label: "Realizados", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "spacetime.done" },
  { appModule: "spacetime", key: "confirmed", label: "Confirmados", icon: CheckCircle2, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/40", format: "number", defaultVisible: true, dataPath: "spacetime.confirmed" },
  { appModule: "spacetime", key: "pending", label: "Pendentes", icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40", format: "number", defaultVisible: true, dataPath: "spacetime.pending" },
  { appModule: "spacetime", key: "cancelled", label: "Cancelados", icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/40", format: "number", defaultVisible: true, dataPath: "spacetime.cancelled" },
  { appModule: "spacetime", key: "noShow", label: "No-show", icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/40", format: "number", defaultVisible: true, description: "Não compareceu", dataPath: "spacetime.noShow" },
  { appModule: "spacetime", key: "withLead", label: "Com lead vinculado", icon: Users, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40", format: "number", defaultVisible: true, description: "Agendamentos rastreáveis", dataPath: "spacetime.withLead" },
  // Novos
  { appModule: "spacetime", key: "noShowRate", label: "Taxa de no-show", icon: Percent, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/40", format: "percent", defaultVisible: false, description: "% de agendamentos com NO_SHOW", dataPath: "spacetime.noShowRate" },
  { appModule: "spacetime", key: "avgDuration", label: "Duração média", icon: Timer, color: "text-blue-700", bg: "bg-blue-50 dark:bg-blue-950/40", format: "duration", defaultVisible: false, description: "Tempo médio entre início e fim", dataPath: "spacetime.avgDuration" },
];

// ─── Chat ───────────────────────────────────────────────────────────────────

const CHAT: MetricDef[] = [
  { appModule: "chat", key: "totalConversations", label: "Total de conversas", icon: MessageSquare, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40", format: "number", defaultVisible: true, dataPath: "chat.totalConversations" },
  { appModule: "chat", key: "totalMessages", label: "Total de mensagens", icon: Send, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40", format: "number", defaultVisible: true, dataPath: "chat.totalMessages" },
  { appModule: "chat", key: "attendedConversations", label: "Em atendimento", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "chat.attendedConversations" },
  { appModule: "chat", key: "unattendedConversations", label: "Aguardando atendimento", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40", format: "number", defaultVisible: true, dataPath: "chat.unattendedConversations" },
  // Novos
  { appModule: "chat", key: "avgConversationDuration", label: "Duração média da conversa", icon: Timer, color: "text-violet-700", bg: "bg-violet-50 dark:bg-violet-950/40", format: "duration", defaultVisible: false, description: "Tempo entre criação e última mensagem", dataPath: "chat.avgConversationDuration" },
  { appModule: "chat", key: "fromMeRatio", label: "Mensagens enviadas / Total", icon: Percent, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40", format: "percent", defaultVisible: false, description: "% das mensagens enviadas pelo time", dataPath: "chat.fromMeRatio" },
];

// ─── NASA Planner (Posts) ───────────────────────────────────────────────────

const NASA_PLANNER: MetricDef[] = [
  { appModule: "nasa-planner", key: "total", label: "Total de posts", icon: Sparkles, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950/40", format: "number", defaultVisible: true, dataPath: "nasaPlanner.total" },
  { appModule: "nasa-planner", key: "published", label: "Publicados", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "nasaPlanner.published" },
  { appModule: "nasa-planner", key: "scheduled", label: "Agendados", icon: Clock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "nasaPlanner.scheduled" },
  { appModule: "nasa-planner", key: "draft", label: "Rascunhos", icon: FileText, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-950/40", format: "number", defaultVisible: true, dataPath: "nasaPlanner.draft" },
  { appModule: "nasa-planner", key: "starsSpent", label: "Stars consumidas", icon: Star, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/40", format: "number", defaultVisible: true, dataPath: "nasaPlanner.starsSpent" },
];

// ─── Workspace ──────────────────────────────────────────────────────────────

const WORKSPACE: MetricDef[] = [
  { appModule: "workspace", key: "total", label: "Total de ações", icon: ListTodo, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40", format: "number", defaultVisible: true, dataPath: "workspace.total" },
  { appModule: "workspace", key: "done", label: "Concluídas", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "workspace.done" },
  { appModule: "workspace", key: "open", label: "Em aberto", icon: Clock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "workspace.open" },
  { appModule: "workspace", key: "overdue", label: "Atrasadas", icon: AlertCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/40", format: "number", defaultVisible: true, dataPath: "workspace.overdue" },
  // Novos
  { appModule: "workspace", key: "avgCompletionTime", label: "Tempo médio de finalização", icon: Timer, color: "text-amber-700", bg: "bg-amber-50 dark:bg-amber-950/40", format: "duration", defaultVisible: false, description: "Tempo médio entre criação e fechamento", dataPath: "workspace.avgCompletionTime" },
  { appModule: "workspace", key: "topFastestCreator", label: "Criador mais rápido", icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/40", format: "ranking", defaultVisible: false, description: "User que mais rapidamente fecha as ações que cria", dataPath: "workspace.topFastestCreator" },
  { appModule: "workspace", key: "subactionRatio", label: "Razão sub-ações / ações", icon: Layers, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/40", format: "number", defaultVisible: false, description: "Quantidade média de sub-ações por ação", dataPath: "workspace.subactionRatio" },
];

// ─── Forms ──────────────────────────────────────────────────────────────────

const FORMS: MetricDef[] = [
  { appModule: "forms", key: "totalForms", label: "Total de forms", icon: FormInput, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/40", format: "number", defaultVisible: true, dataPath: "forms.totalForms" },
  { appModule: "forms", key: "totalResponses", label: "Respostas", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "forms.totalResponses" },
  { appModule: "forms", key: "totalViews", label: "Visualizações", icon: Eye, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "forms.totalViews" },
  { appModule: "forms", key: "responsesWithLead", label: "Geraram lead", icon: Users, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40", format: "number", defaultVisible: true, dataPath: "forms.responsesWithLead" },
  // Novo
  { appModule: "forms", key: "abandonRate", label: "Taxa de abandono", icon: Percent, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/40", format: "percent", defaultVisible: false, description: "Views sem resposta / total de views", dataPath: "forms.abandonRate" },
];

// ─── N-Box ──────────────────────────────────────────────────────────────────

const NBOX: MetricDef[] = [
  { appModule: "nbox", key: "totalItems", label: "Itens", icon: Inbox, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/40", format: "number", defaultVisible: true, dataPath: "nbox.totalItems" },
  { appModule: "nbox", key: "publicItems", label: "Públicos", icon: Eye, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "nbox.publicItems" },
  { appModule: "nbox", key: "totalSize", label: "Espaço usado", icon: Download, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40", format: "number", defaultVisible: true, dataPath: "nbox.totalSize" },
];

// ─── Payment ────────────────────────────────────────────────────────────────

const PAYMENT: MetricDef[] = [
  { appModule: "payment", key: "revenue", label: "Receita", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "currency", defaultVisible: true, dataPath: "payment.revenue" },
  { appModule: "payment", key: "expense", label: "Despesa", icon: Receipt, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/40", format: "currency", defaultVisible: true, dataPath: "payment.expense" },
  { appModule: "payment", key: "pendingAmount", label: "Pendentes", icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40", format: "currency", defaultVisible: true, dataPath: "payment.pendingAmount" },
  { appModule: "payment", key: "overdueAmount", label: "Atrasados", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/40", format: "currency", defaultVisible: true, dataPath: "payment.overdueAmount" },
  { appModule: "payment", key: "avgTicket", label: "Ticket médio", icon: Wallet, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/40", format: "currency", defaultVisible: true, dataPath: "payment.avgTicket" },
  // Novo
  { appModule: "payment", key: "avgDSR", label: "Dias médios até recebimento", icon: Timer, color: "text-amber-700", bg: "bg-amber-50 dark:bg-amber-950/40", format: "duration", defaultVisible: false, description: "Tempo médio entre vencimento e pagamento (DSR)", dataPath: "payment.avgDSR" },
];

// ─── Linnker ────────────────────────────────────────────────────────────────

const LINNKER: MetricDef[] = [
  { appModule: "linnker", key: "totalScans", label: "Acessos", icon: Link2, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/40", format: "number", defaultVisible: true, dataPath: "linnker.totalScans" },
  { appModule: "linnker", key: "scansWithLead", label: "Capturaram lead", icon: Users, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40", format: "number", defaultVisible: true, dataPath: "linnker.scansWithLead" },
  { appModule: "linnker", key: "totalClicks", label: "Cliques", icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "linnker.totalClicks" },
];

// ─── Space Points ───────────────────────────────────────────────────────────

const SPACE_POINTS: MetricDef[] = [
  { appModule: "space-points", key: "totalBalance", label: "Saldo total", icon: Coins, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/40", format: "number", defaultVisible: true, dataPath: "spacePoints.totalBalance" },
  { appModule: "space-points", key: "granted", label: "Distribuídos", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "spacePoints.granted" },
  { appModule: "space-points", key: "spent", label: "Gastos", icon: ShoppingCart, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/40", format: "number", defaultVisible: true, dataPath: "spacePoints.spent" },
  { appModule: "space-points", key: "activeUsers", label: "Usuários ativos", icon: Users, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "spacePoints.activeUsers" },
];

// ─── Stars ──────────────────────────────────────────────────────────────────

const STARS: MetricDef[] = [
  { appModule: "stars", key: "lastBalance", label: "Saldo atual", icon: Star, color: "text-fuchsia-600", bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", format: "number", defaultVisible: true, dataPath: "stars.lastBalance" },
  { appModule: "stars", key: "topupTotal", label: "Compradas", icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "stars.topupTotal" },
  { appModule: "stars", key: "appCharges", label: "Consumidas", icon: TrendingUp, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/40", format: "number", defaultVisible: true, dataPath: "stars.appCharges" },
];

// ─── Space Station ──────────────────────────────────────────────────────────

const SPACE_STATION: MetricDef[] = [
  { appModule: "space-station", key: "stations", label: "Estações", icon: Rocket, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/40", format: "number", defaultVisible: true, dataPath: "spaceStation.stations" },
  { appModule: "space-station", key: "publicStations", label: "Públicas", icon: Eye, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "spaceStation.publicStations" },
  { appModule: "space-station", key: "starsSent", label: "Stars enviadas", icon: Send, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "spaceStation.starsSent" },
  { appModule: "space-station", key: "starsReceived", label: "Stars recebidas", icon: Download, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40", format: "number", defaultVisible: true, dataPath: "spaceStation.starsReceived" },
];

// ─── NASA Route ─────────────────────────────────────────────────────────────

const NASA_ROUTE: MetricDef[] = [
  { appModule: "nasa-route", key: "courses", label: "Cursos", icon: MapIcon, color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/40", format: "number", defaultVisible: true, dataPath: "nasaRoute.courses" },
  { appModule: "nasa-route", key: "students", label: "Alunos", icon: GraduationCap, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40", format: "number", defaultVisible: true, dataPath: "nasaRoute.students" },
  { appModule: "nasa-route", key: "enrollmentsPaid", label: "Matrículas pagas", icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "nasaRoute.enrollmentsPaid" },
  { appModule: "nasa-route", key: "revenueStars", label: "Receita em stars", icon: Star, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/40", format: "number", defaultVisible: true, dataPath: "nasaRoute.revenueStars" },
  { appModule: "nasa-route", key: "completed", label: "Concluídos", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "nasaRoute.completed" },
  { appModule: "nasa-route", key: "certificates", label: "Certificados", icon: Award, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40", format: "number", defaultVisible: true, dataPath: "nasaRoute.certificates" },
  // Novos
  { appModule: "nasa-route", key: "completionRate", label: "Taxa de conclusão", icon: Percent, color: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "percent", defaultVisible: false, description: "% de matrículas com curso concluído", dataPath: "nasaRoute.completionRate" },
  { appModule: "nasa-route", key: "avgTimeToCertificate", label: "Tempo médio até certificado", icon: Timer, color: "text-sky-700", bg: "bg-sky-50 dark:bg-sky-950/40", format: "duration", defaultVisible: false, description: "Tempo médio entre matrícula e emissão", dataPath: "nasaRoute.avgTimeToCertificate" },
];

// ─── Tracking (Leads & Pipeline — chamadas extras pra performance) ──────────

const TRACKING: MetricDef[] = [
  // KPIs base — já cobertos pelo KPIGeneralCards no topo da aba Tracking.
  // Por isso defaultVisible=false: a seção "Performance de Tracking"
  // começa vazia. O usuário escolhe explicitamente o que mostrar via +.
  { appModule: "tracking", key: "totalLeads", label: "Total de leads", icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: false, dataPath: "summary.totalLeads" },
  { appModule: "tracking", key: "activeLeads", label: "Leads ativos", icon: Target, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40", format: "number", defaultVisible: false, dataPath: "summary.activeLeads" },
  { appModule: "tracking", key: "wonLeads", label: "Leads ganhos", icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: false, dataPath: "summary.wonLeads" },
  { appModule: "tracking", key: "lostLeads", label: "Leads perdidos", icon: XCircle, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/40", format: "number", defaultVisible: false, dataPath: "summary.lostLeads" },
  // Performance — vem de getTrackingPerformance, chamado sob demanda
  { appModule: "tracking", key: "avgTimePerStatus", label: "Tempo médio por status", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/40", format: "ranking", defaultVisible: false, description: "Tempo médio que leads passam em cada etapa do funil", dataPath: "trackingPerformance.avgTimePerStatus" },
  { appModule: "tracking", key: "avgFirstResponseByAttendant", label: "Tempo médio de 1ª resposta por atendente", icon: Clock, color: "text-blue-700", bg: "bg-blue-50 dark:bg-blue-950/40", format: "ranking", defaultVisible: false, description: "Top atendentes ordenados por rapidez de primeira resposta", dataPath: "trackingPerformance.avgFirstResponseByAttendant" },
  { appModule: "tracking", key: "conversionRateByAttendant", label: "Performance de conversão por atendente", icon: Trophy, color: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "ranking", defaultVisible: false, description: "Top 5 atendentes por taxa de conversão (won/total)", dataPath: "trackingPerformance.conversionRateByAttendant" },
];

// ─── Integrations (Meta Ads) — sem novas métricas, mantém igual ──────────

const INTEGRATIONS: MetricDef[] = [
  { appModule: "integrations", key: "metaSpend", label: "Investimento Meta Ads", icon: DollarSign, color: "text-[#0082FB]", bg: "bg-blue-50 dark:bg-blue-950/40", format: "currency", defaultVisible: true, dataPath: "metaAds.spend" },
  { appModule: "integrations", key: "metaLeads", label: "Leads Meta", icon: Users, color: "text-[#0082FB]", bg: "bg-blue-50 dark:bg-blue-950/40", format: "number", defaultVisible: true, dataPath: "metaAds.leads" },
  { appModule: "integrations", key: "metaCPL", label: "CPL", icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40", format: "currency", defaultVisible: true, dataPath: "metaAds.cpl" },
  { appModule: "integrations", key: "metaROAS", label: "ROAS", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", format: "number", defaultVisible: true, dataPath: "metaAds.roas" },
];

// ─── Metadata da seção (header da seção no dashboard) ──────────────────────

export interface SectionMeta {
  label: string;
  description?: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export const SECTION_META: Partial<Record<AppModule, SectionMeta>> = {
  tracking: { label: "Performance de Tracking", description: "Tempo por status, performance por atendente e conversão", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  forge: { label: "Forge — Propostas & Contratos", description: "Propostas comerciais geradas e contratos assinados no período", icon: Flame, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/40" },
  spacetime: { label: "SpaceTime — Agendamentos", description: "Reuniões e compromissos agendados no período", icon: Calendar, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40" },
  "nasa-planner": { label: "NASA Post — Conteúdo", description: "Posts criados e publicados no período", icon: Sparkles, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950/40" },
  integrations: { label: "Integrações — Meta Ads", description: "Investimento e performance em campanhas Meta", icon: Plug, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
  workspace: { label: "Workspace — Ações", description: "Tarefas e ações registradas no Workspace", icon: ListTodo, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40" },
  forms: { label: "Formulários", description: "Formulários publicados e respostas recebidas", icon: FormInput, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/40" },
  nbox: { label: "N-Box — Conteúdo", description: "Itens armazenados no N-Box", icon: Inbox, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/40" },
  payment: { label: "Pagamentos", description: "Movimentação financeira no período", icon: Wallet, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/40" },
  linnker: { label: "Linnker", description: "Acessos a páginas Linnker e captação de leads", icon: Link2, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/40" },
  "space-points": { label: "Space Points", description: "Saldo e movimentação de pontos da empresa", icon: Coins, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/40" },
  stars: { label: "Stars", description: "Saldo e movimentação de Stars da empresa", icon: Star, color: "text-fuchsia-600", bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40" },
  "space-station": { label: "Space Station", description: "Estações, acessos e stars trocadas", icon: Rocket, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  "nasa-route": { label: "NASA Route — Cursos", description: "Cursos publicados, matrículas e conclusões", icon: MapIcon, color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/40" },
};

// ─── Catálogo agregado ──────────────────────────────────────────────────────

export const METRIC_CATALOG: MetricDef[] = [
  ...TRACKING,
  ...CHAT,
  ...FORGE,
  ...SPACETIME,
  ...NASA_PLANNER,
  ...INTEGRATIONS,
  ...WORKSPACE,
  ...FORMS,
  ...NBOX,
  ...PAYMENT,
  ...LINNKER,
  ...SPACE_POINTS,
  ...STARS,
  ...SPACE_STATION,
  ...NASA_ROUTE,
];

/**
 * Retorna todas as métricas de um app específico.
 */
export function getMetricsForApp(appModule: AppModule): MetricDef[] {
  return METRIC_CATALOG.filter((m) => m.appModule === appModule);
}

/**
 * Retorna as métricas default-visíveis de um app — fallback quando não
 * há `section-prefs` block persistido pra esse app.
 */
export function getDefaultVisibleKeys(appModule: AppModule): string[] {
  return getMetricsForApp(appModule)
    .filter((m) => m.defaultVisible)
    .map((m) => m.key);
}

/**
 * Acha uma métrica específica do catálogo pelo (app, key).
 */
export function findMetric(appModule: AppModule, key: string): MetricDef | undefined {
  return METRIC_CATALOG.find(
    (m) => m.appModule === appModule && m.key === key,
  );
}

/**
 * Acessa um valor aninhado dentro de um payload via dot-path.
 * Ex: resolveDataPath({forge: {pagas: 5}}, "forge.pagas") === 5
 */
export function resolveDataPath(payload: unknown, path: string): unknown {
  if (payload == null) return undefined;
  const parts = path.split(".");
  let cur: unknown = payload;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Formata um valor numérico de acordo com o `format` declarado no catálogo.
 * Retorna string. Para format=ranking retorna "" (caller deve renderizar
 * UI customizada).
 */
export function formatMetricValue(
  value: unknown,
  format: MetricFormat,
): string {
  if (value == null || value === undefined) return "—";
  if (format === "ranking") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (format === "currency") {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }
  if (format === "percent") {
    return `${n.toFixed(n >= 10 ? 0 : 1)}%`;
  }
  if (format === "duration") {
    // n vem em horas (convenção do backend)
    if (n < 1) return `${Math.round(n * 60)} min`;
    if (n < 48) return `${n.toFixed(1)} h`;
    return `${(n / 24).toFixed(1)} dias`;
  }
  return n.toLocaleString("pt-BR");
}
