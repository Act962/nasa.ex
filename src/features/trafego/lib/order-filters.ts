/** Agrupamento dos pedidos em filtros simples para a lista "Minhas campanhas". */

import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import { isOrderEditable, isTerminalOrderStatus } from "./order-status";

export type OrderFilterKey =
  | "all"
  | "needsYou"
  | "withTeam"
  | "live"
  | "finished";

export const ORDER_FILTER_LABEL: Record<OrderFilterKey, string> = {
  all: "Todas",
  needsYou: "Precisam de você",
  withTeam: "Com a equipe",
  live: "No ar",
  finished: "Encerradas",
};

export const ORDER_FILTER_KEYS: OrderFilterKey[] = [
  "all",
  "needsYou",
  "withTeam",
  "live",
  "finished",
];

const LIVE_STATUSES: TrafegoOrderStatus[] = ["RUNNING", "PAUSED"];

export function orderNeedsClientAction(status: TrafegoOrderStatus): boolean {
  return isOrderEditable(status);
}

export function matchesOrderFilter(
  status: TrafegoOrderStatus,
  filterKey: OrderFilterKey,
): boolean {
  switch (filterKey) {
    case "all":
      return true;
    case "needsYou":
      return orderNeedsClientAction(status);
    case "live":
      return LIVE_STATUSES.includes(status);
    case "finished":
      return isTerminalOrderStatus(status);
    case "withTeam":
      return (
        !orderNeedsClientAction(status) &&
        !LIVE_STATUSES.includes(status) &&
        !isTerminalOrderStatus(status)
      );
  }
}

/** Cancelado e reembolsado não contam como dinheiro investido. */
export function countsAsInvestment(status: TrafegoOrderStatus): boolean {
  return status !== "CANCELLED" && status !== "REFUNDED";
}
