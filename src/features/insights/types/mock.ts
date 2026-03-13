import type { DashboardReport } from "../types";

export const mockDashboardData: DashboardReport = {
  summary: {
    totalLeads: 0,
    activeLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
    soldThisMonth: 0,
    soldLastMonth: 0,
    monthGrowthRate: 0,
    totalConversations: 0,
    totalMessages: 0,
    sentMessages: 0,
    receivedMessages: 0,
    avgTimeToFirstResponse: 0, // seconds
  },
  byStatus: [
    {
      status: { id: "1", name: "Novo", color: "#3B82F6" },
      count: 156,
      leadIds: [],
    },
    {
      status: { id: "2", name: "Qualificado", color: "#8B5CF6" },
      count: 234,
      leadIds: [],
    },
    {
      status: { id: "3", name: "Proposta", color: "#F59E0B" },
      count: 189,
      leadIds: [],
    },
    {
      status: { id: "4", name: "Negociação", color: "#EF4444" },
      count: 167,
      leadIds: [],
    },
    {
      status: { id: "5", name: "Fechado", color: "#10B981" },
      count: 287,
      leadIds: [],
    },
    {
      status: { id: "6", name: "Perdido", color: "#6B7280" },
      count: 214,
      leadIds: [],
    },
  ],
  byChannel: [
    { source: "Website", count: 423, leadIds: [] },
    { source: "Indicação", count: 312, leadIds: [] },
    { source: "LinkedIn", count: 198, leadIds: [] },
    { source: "Google Ads", count: 156, leadIds: [] },
    { source: "Instagram", count: 98, leadIds: [] },
    { source: "Email", count: 60, leadIds: [] },
  ],
  byAttendant: [
    {
      responsible: { id: "1", name: "Ana Silva", image: null },
      isUnassigned: false,
      leadIds: [],
      total: 312,
      won: 187,
    },
    {
      responsible: { id: "2", name: "Carlos Santos", image: null },
      isUnassigned: false,
      leadIds: [],
      total: 287,
      won: 156,
    },
    {
      responsible: { id: "3", name: "Maria Oliveira", image: null },
      isUnassigned: false,
      total: 256,
      leadIds: [],
      won: 178,
    },
    {
      responsible: { id: "4", name: "João Costa", image: null },
      isUnassigned: false,
      total: 234,
      leadIds: [],
      won: 112,
    },
    {
      responsible: { id: "5", name: "Paula Ferreira", image: null },
      isUnassigned: false,
      total: 98,
      leadIds: [],
      won: 54,
    },
    {
      responsible: null,
      isUnassigned: true,
      total: 60,
      leadIds: [],
      won: 0,
    },
  ],
  topTags: [
    {
      tag: { id: "1", name: "Enterprise", color: "#3B82F6" },
      count: 234,
      leadIds: [],
    },
    {
      tag: { id: "2", name: "PME", color: "#10B981" },
      count: 312,
      leadIds: [],
    },
    {
      tag: { id: "3", name: "Startup", color: "#F59E0B" },
      count: 156,
      leadIds: [],
    },
    {
      tag: { id: "4", name: "Governo", color: "#8B5CF6" },
      count: 89,
      leadIds: [],
    },
    { tag: { id: "5", name: "ONG", color: "#EF4444" }, count: 67, leadIds: [] },
    {
      tag: { id: "6", name: "Educação", color: "#EC4899" },
      count: 54,
      leadIds: [],
    },
    {
      tag: { id: "7", name: "Saúde", color: "#14B8A6" },
      count: 48,
      leadIds: [],
    },
    {
      tag: { id: "8", name: "Varejo", color: "#F97316" },
      count: 42,
      leadIds: [],
    },
  ],
};

export const trackingOptions = [
  { id: "tracking-1", name: "Vendas B2B" },
  { id: "tracking-2", name: "Marketing Digital" },
  { id: "tracking-3", name: "Suporte Premium" },
  { id: "tracking-4", name: "Parcerias" },
];
