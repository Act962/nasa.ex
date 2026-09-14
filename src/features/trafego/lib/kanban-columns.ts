/**
 * Colunas do tracking de operação do trafeGO e o mapa status ↔ coluna.
 *
 * O tracking é a mesa de trabalho do gestor: cada status do pedido tem uma
 * coluna, mais "Aguardando pagamento" (antes do pedido existir). Cancelado e
 * reembolsado não têm coluna — o card vira perdido.
 *
 * O mapa (`TrafegoSettings.statusColumnMap`) guarda `Status.id` por chave, e
 * é preenchido ao provisionar o tracking pelo admin.
 */

import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_LABEL } from "./order-status";

export const AWAITING_PAYMENT_COLUMN_KEY = "AWAITING_PAYMENT" as const;

export type TrafegoColumnKey =
  | TrafegoOrderStatus
  | typeof AWAITING_PAYMENT_COLUMN_KEY;

export interface TrafegoKanbanColumnSpec {
  key: TrafegoColumnKey;
  name: string;
  color: string;
  order: number;
}

export const TRAFEGO_KANBAN_COLUMNS: TrafegoKanbanColumnSpec[] = [
  { key: "AWAITING_PAYMENT", name: "Aguardando pagamento", color: "#94a3b8", order: 0 },
  { key: "PAID", name: ORDER_STATUS_LABEL.PAID, color: "#22c55e", order: 1 },
  { key: "ACCOUNT_REVIEW", name: ORDER_STATUS_LABEL.ACCOUNT_REVIEW, color: "#0ea5e9", order: 2 },
  { key: "ONBOARDING", name: ORDER_STATUS_LABEL.ONBOARDING, color: "#f59e0b", order: 3 },
  { key: "MATERIALS_SUBMITTED", name: ORDER_STATUS_LABEL.MATERIALS_SUBMITTED, color: "#38bdf8", order: 4 },
  { key: "REQUESTED", name: ORDER_STATUS_LABEL.REQUESTED, color: "#8b5cf6", order: 5 },
  { key: "IN_REVIEW", name: ORDER_STATUS_LABEL.IN_REVIEW, color: "#7c3aed", order: 6 },
  { key: "SCHEDULED", name: ORDER_STATUS_LABEL.SCHEDULED, color: "#0284c7", order: 7 },
  { key: "RUNNING", name: ORDER_STATUS_LABEL.RUNNING, color: "#16a34a", order: 8 },
  { key: "COMPLETED", name: ORDER_STATUS_LABEL.COMPLETED, color: "#64748b", order: 9 },
  { key: "CHANGES_REQUESTED", name: ORDER_STATUS_LABEL.CHANGES_REQUESTED, color: "#f97316", order: 10 },
  { key: "PAUSED", name: ORDER_STATUS_LABEL.PAUSED, color: "#eab308", order: 11 },
];

/** Status sem coluna: o card é marcado como perdido em vez de movido. */
export const LOST_ORDER_STATUSES: TrafegoOrderStatus[] = ["CANCELLED", "REFUNDED"];

/**
 * Chaves que só posicionam o card. Arrastar um card PARA elas nunca muda o
 * pedido: dinheiro só se confirma pelo Stripe ou pelo "Confirmar PIX".
 */
export const PLACEMENT_ONLY_COLUMN_KEYS: TrafegoColumnKey[] = [
  "AWAITING_PAYMENT",
  "PAID",
];

export type TrafegoStatusColumnMap = Partial<Record<TrafegoColumnKey, string>>;

const COLUMN_KEYS = new Set<string>(TRAFEGO_KANBAN_COLUMNS.map((column) => column.key));

export function isTrafegoColumnKey(value: string): value is TrafegoColumnKey {
  return COLUMN_KEYS.has(value);
}

/** Lê o JSON gravado em `TrafegoSettings.statusColumnMap`, ignorando lixo. */
export function parseStatusColumnMap(raw: unknown): TrafegoStatusColumnMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const map: TrafegoStatusColumnMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isTrafegoColumnKey(key) && typeof value === "string" && value.trim()) {
      map[key] = value;
    }
  }
  return map;
}

export function columnKeyForStatusId(
  map: TrafegoStatusColumnMap,
  statusId: string,
): TrafegoColumnKey | null {
  for (const [key, mappedStatusId] of Object.entries(map)) {
    if (mappedStatusId === statusId && isTrafegoColumnKey(key)) return key;
  }
  return null;
}

export function columnSpecForKey(key: TrafegoColumnKey): TrafegoKanbanColumnSpec | null {
  return TRAFEGO_KANBAN_COLUMNS.find((column) => column.key === key) ?? null;
}
