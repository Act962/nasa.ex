/** Rótulos, cores e regras de transição dos status de pedido do trafeGO. */

import type { TrafegoOrderStatus } from "@/generated/prisma/enums";

export const ORDER_STATUS_LABEL: Record<TrafegoOrderStatus, string> = {
  PAID: "Pagamento confirmado",
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
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ONBOARDING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  MATERIALS_SUBMITTED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  REQUESTED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  IN_REVIEW: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  CHANGES_REQUESTED: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  SCHEDULED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  RUNNING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

/**
 * Ordem exibida na timeline do cliente. Status de exceção (CANCELLED, REFUNDED,
 * PAUSED, CHANGES_REQUESTED) ficam de fora: aparecem como evento, não como etapa.
 */
export const ORDER_TIMELINE_STEPS: TrafegoOrderStatus[] = [
  "PAID",
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "REQUESTED",
  "IN_REVIEW",
  "SCHEDULED",
  "RUNNING",
  "COMPLETED",
];

/** Status em que o cliente ainda pode editar criativos, copies e briefing. */
export const EDITABLE_ORDER_STATUSES: TrafegoOrderStatus[] = [
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "CHANGES_REQUESTED",
];

/** Status a partir dos quais "Ativar campanha" reivindica o pedido. */
export const ACTIVATABLE_ORDER_STATUSES: TrafegoOrderStatus[] = [
  "ONBOARDING",
  "MATERIALS_SUBMITTED",
  "CHANGES_REQUESTED",
];

export function isOrderEditable(status: TrafegoOrderStatus): boolean {
  return EDITABLE_ORDER_STATUSES.includes(status);
}

export function isOrderActivatable(status: TrafegoOrderStatus): boolean {
  return ACTIVATABLE_ORDER_STATUSES.includes(status);
}
