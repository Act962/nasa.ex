import { GanttChartIcon, NetworkIcon, CheckSquareIcon, MapIcon } from "lucide-react";
import { dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Calendar ─────────────────────────────────────────────────────────────────

const locales = { "pt-BR": ptBR };

export const calendarLocalizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ptBR }),
  getDay,
  locales,
});

// ─── Posts ────────────────────────────────────────────────────────────────────

export const POST_STATUSES = [
  { key: "DRAFT", label: "Rascunho", color: "secondary" },
  { key: "PENDING_APPROVAL", label: "Aguardando Aprovação", color: "warning" },
  { key: "CHANGES_REQUESTED", label: "Ajustes pedidos", color: "warning" },
  { key: "APPROVED", label: "Aprovado", color: "default" },
  { key: "SCHEDULED", label: "Agendado", color: "outline" },
  { key: "PUBLISHED", label: "Publicado", color: "default" },
  { key: "FAILED", label: "Falhou", color: "destructive" },
] as const;

/** Status que dá para escolher na mão; programar e publicar passam pelo fluxo próprio (spec 0057). */
const MANUAL_POST_STATUS_KEYS = ["DRAFT", "PENDING_APPROVAL", "APPROVED"] as const;

export type ManualPostStatus = (typeof MANUAL_POST_STATUS_KEYS)[number];

type ManualPostStatusOption = Extract<(typeof POST_STATUSES)[number], { key: ManualPostStatus }>;

export const MANUAL_POST_STATUSES = POST_STATUSES.filter((status): status is ManualPostStatusOption =>
  MANUAL_POST_STATUS_KEYS.some((manualKey) => manualKey === status.key),
);

export const POST_TYPES: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  CAROUSEL: "Carrossel",
  TEXT: "Texto",
  STORY: "Story",
  REEL: "Reel",
};

export const POST_NETWORKS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  TWITTER: "X/Twitter",
  TIKTOK: "TikTok",
};

// ─── Cards ────────────────────────────────────────────────────────────────────

export const CARD_STATUSES: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  TODO: { label: "A Fazer", variant: "secondary" },
  IN_PROGRESS: { label: "Em Andamento", variant: "default" },
  DONE: { label: "Concluído", variant: "outline" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

// ─── Mind Maps ────────────────────────────────────────────────────────────────

export const MIND_MAP_TEMPLATES = [
  { key: "mindmap", label: "Mapa Mental", icon: NetworkIcon, description: "Organize ideias de forma visual" },
  { key: "gantt", label: "Gantt", icon: GanttChartIcon, description: "Planejamento de tarefas e prazos" },
  { key: "diagram", label: "Diagrama", icon: MapIcon, description: "Fluxogramas e diagramas" },
  { key: "checklist", label: "Checklist", icon: CheckSquareIcon, description: "Lista de verificação de tarefas" },
] as const;
