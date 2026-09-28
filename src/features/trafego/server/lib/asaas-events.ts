/**
 * Eventos do Asaas que o trafeGO trata. O que não estiver aqui é reconhecido
 * com 200 e descartado — a fila do Asaas não pode ser penalizada por um evento
 * que simplesmente não nos interessa.
 */
export const TRAFEGO_ASAAS_HANDLED_EVENTS = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_DELETED",
] as const;

export type TrafegoAsaasEvent =
  (typeof TRAFEGO_ASAAS_HANDLED_EVENTS)[number];

export function isHandledTrafegoAsaasEvent(
  event: string,
): event is TrafegoAsaasEvent {
  return (TRAFEGO_ASAAS_HANDLED_EVENTS as readonly string[]).includes(event);
}

/** Estados em que o dinheiro está com a gente — os únicos que liberam pedido. */
export const ASAAS_PAID_STATUSES = [
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
] as const;
