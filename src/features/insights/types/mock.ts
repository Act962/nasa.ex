import type { DashboardReport } from "../types";

export const mockDashboardData: DashboardReport = {
  summary: {
    totalLeads: 1247,
    activeLeads: 342,
    wonLeads: 687,
    lostLeads: 218,
    conversionRate: 75.91,
    soldThisMonth: 89,
    soldLastMonth: 72,
    monthGrowthRate: 23.61,
  },
  byStatus: [
    { status: { id: "1", name: "Novo", color: "#3B82F6" }, count: 156 },
    { status: { id: "2", name: "Qualificado", color: "#8B5CF6" }, count: 234 },
    { status: { id: "3", name: "Proposta", color: "#F59E0B" }, count: 189 },
    { status: { id: "4", name: "Negociação", color: "#EF4444" }, count: 167 },
    { status: { id: "5", name: "Fechado", color: "#10B981" }, count: 287 },
    { status: { id: "6", name: "Perdido", color: "#6B7280" }, count: 214 },
  ],
  byChannel: [
    { source: "Website", count: 423 },
    { source: "Indicação", count: 312 },
    { source: "LinkedIn", count: 198 },
    { source: "Google Ads", count: 156 },
    { source: "Instagram", count: 98 },
    { source: "Email", count: 60 },
  ],
  byAttendant: [
    {
      responsible: { id: "1", name: "Ana Silva", image: null },
      isUnassigned: false,
      total: 312,
      won: 187,
    },
    {
      responsible: { id: "2", name: "Carlos Santos", image: null },
      isUnassigned: false,
      total: 287,
      won: 156,
    },
    {
      responsible: { id: "3", name: "Maria Oliveira", image: null },
      isUnassigned: false,
      total: 256,
      won: 178,
    },
    {
      responsible: { id: "4", name: "João Costa", image: null },
      isUnassigned: false,
      total: 234,
      won: 112,
    },
    {
      responsible: { id: "5", name: "Paula Ferreira", image: null },
      isUnassigned: false,
      total: 98,
      won: 54,
    },
    {
      responsible: null,
      isUnassigned: true,
      total: 60,
      won: 0,
    },
  ],
  topTags: [
    { tag: { id: "1", name: "Enterprise", color: "#3B82F6" }, count: 234 },
    { tag: { id: "2", name: "PME", color: "#10B981" }, count: 312 },
    { tag: { id: "3", name: "Startup", color: "#F59E0B" }, count: 156 },
    { tag: { id: "4", name: "Governo", color: "#8B5CF6" }, count: 89 },
    { tag: { id: "5", name: "ONG", color: "#EF4444" }, count: 67 },
    { tag: { id: "6", name: "Educação", color: "#EC4899" }, count: 54 },
    { tag: { id: "7", name: "Saúde", color: "#14B8A6" }, count: 48 },
    { tag: { id: "8", name: "Varejo", color: "#F97316" }, count: 42 },
  ],
};

export const trackingOptions = [
  { id: "tracking-1", name: "Vendas B2B" },
  { id: "tracking-2", name: "Marketing Digital" },
  { id: "tracking-3", name: "Suporte Premium" },
  { id: "tracking-4", name: "Parcerias" },
];
