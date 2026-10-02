/** Rótulos, cores e regras de transição dos status de pedido do trafeGO. */

import type { TrafegoOrderStatus } from "@/generated/prisma/enums";

export const ORDER_STATUS_LABEL: Record<TrafegoOrderStatus, string> = {
  PAID: "Pagamento confirmado",
  ACCOUNT_REVIEW: "Análise da conta de tráfego",
  ONBOARDING: "Aguardando seus materiais",
  MATERIALS_SUBMITTED: "Materiais enviados",
  REQUESTED: "Na fila da equipe",
  IN_REVIEW: "Em análise",
  CHANGES_REQUESTED: "Ajustes solicitados",
  SCHEDULED: "Agendada",
  RUNNING: "No ar",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
};

export const ORDER_STATUS_STYLE: Record<TrafegoOrderStatus, string> = {
  PAID: "bg-success/15 text-success",
  ACCOUNT_REVIEW: "bg-info/15 text-info",
  ONBOARDING: "bg-warning/15 text-warning",
  MATERIALS_SUBMITTED: "bg-info/15 text-info",
  REQUESTED: "bg-info/15 text-info",
  IN_REVIEW: "bg-info/15 text-info",
  CHANGES_REQUESTED: "bg-warning/15 text-warning",
  SCHEDULED: "bg-info/15 text-info",
  RUNNING: "bg-success/15 text-success",
  PAUSED: "bg-warning/15 text-warning",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-destructive/15 text-destructive",
};

/**
 * Ordem exibida na timeline do cliente. Status de exceção (CANCELLED, REFUNDED,
 * PAUSED, CHANGES_REQUESTED) ficam de fora: aparecem como evento, não como etapa.
 */
export const ORDER_TIMELINE_STEPS: TrafegoOrderStatus[] = [
  "PAID",
  "ACCOUNT_REVIEW",
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "REQUESTED",
  "IN_REVIEW",
  "SCHEDULED",
  "RUNNING",
  "COMPLETED",
];

/**
 * Status em que o cliente ainda pode editar criativos, copies e briefing.
 * Inclui ACCOUNT_REVIEW de propósito: enquanto a equipe analisa a conta, o
 * cliente já adianta os materiais — as duas frentes andam em paralelo.
 */
export const EDITABLE_ORDER_STATUSES: TrafegoOrderStatus[] = [
  "ACCOUNT_REVIEW",
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "CHANGES_REQUESTED",
];

/**
 * Status a partir dos quais "Ativar campanha" reivindica o pedido. ACCOUNT_REVIEW
 * fica de fora: ativar antes da conta ser verificada pularia a análise.
 */
export const ACTIVATABLE_ORDER_STATUSES: TrafegoOrderStatus[] = [
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "CHANGES_REQUESTED",
];

/** Status finais: o card deixa de espelhar o pedido e um novo pedido pode assumi-lo. */
export const TERMINAL_ORDER_STATUSES: TrafegoOrderStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

/** Status em que a auto-marcação de "Materiais enviados" pode acontecer. */
export const MATERIALS_AUTO_SUBMIT_FROM: TrafegoOrderStatus[] = [
  "ONBOARDING",
  "CHANGES_REQUESTED",
];

export function isOrderEditable(status: TrafegoOrderStatus): boolean {
  return EDITABLE_ORDER_STATUSES.includes(status);
}

export function isOrderActivatable(status: TrafegoOrderStatus): boolean {
  return ACTIVATABLE_ORDER_STATUSES.includes(status);
}

export function isTerminalOrderStatus(status: TrafegoOrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status);
}
