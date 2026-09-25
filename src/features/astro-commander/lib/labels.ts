import type {
  AstroCommandAutonomy,
  AstroCommandPersona,
  AstroCommandRunStatus,
  AstroCommandRunTrigger,
  AstroCommandStatus,
} from "@/generated/prisma/enums";

/** Rótulos em português usados pela lista, pelos cards e pelos filtros. */

export const PERSONA_LABELS: Record<AstroCommandPersona, string> = {
  SALES: "Vendedor",
  FINANCE: "Financeiro",
  ADMIN: "Administrativo",
  ACCOUNTING: "Contábil",
  CUSTOM: "Livre",
};

export const STATUS_LABELS: Record<AstroCommandStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  ARCHIVED: "Arquivado",
};

export const AUTONOMY_LABELS: Record<AstroCommandAutonomy, string> = {
  DRAFT: "Pede aprovação",
  APPROVE_ABOVE: "Aprova acima do limite",
  AUTO: "Automático",
};

export const RUN_STATUS_LABELS: Record<AstroCommandRunStatus, string> = {
  RUNNING: "Executando",
  SUCCEEDED: "Concluída",
  FAILED: "Falhou",
  WAITING_APPROVAL: "Aguardando aprovação",
  SKIPPED_LIMIT: "Barrada por limite",
  SKIPPED: "Pulada",
};

export const RUN_TRIGGER_LABELS: Record<AstroCommandRunTrigger, string> = {
  SCHEDULE: "Agenda",
  EVENT: "Evento",
  MANUAL: "Manual",
  TEST: "Teste",
};

type BadgeTone = "default" | "secondary" | "destructive" | "outline";

export const STATUS_TONES: Record<AstroCommandStatus, BadgeTone> = {
  DRAFT: "outline",
  ACTIVE: "default",
  PAUSED: "secondary",
  ARCHIVED: "outline",
};

export const RUN_STATUS_TONES: Record<AstroCommandRunStatus, BadgeTone> = {
  RUNNING: "secondary",
  SUCCEEDED: "default",
  FAILED: "destructive",
  WAITING_APPROVAL: "secondary",
  SKIPPED_LIMIT: "outline",
  SKIPPED: "outline",
};

/** Data curta com hora — o formato que a lista e o histórico usam. */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}
