/** Rótulos/variantes de UI pros status de campanha e destinatário. */

/**
 * Status em que a campanha ainda pode receber/editar destinatários e ser
 * (re)disparada. `FAILED` entra aqui porque uma campanha que falhou pode ser
 * reaberta: destinatários que falharam voltam a `PENDING` e ela vira `DRAFT`.
 */
export const EDITABLE_BROADCAST_STATUSES = ["DRAFT", "FAILED"] as const;

export function isBroadcastEditable(status: string): boolean {
  return (EDITABLE_BROADCAST_STATUSES as readonly string[]).includes(status);
}

export const BROADCAST_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  SENDING: "Enviando",
  SENT: "Enviada",
  PAUSED: "Pausada",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

/** Classes Tailwind por status — badges com cor semântica (light + dark). */
export const BROADCAST_STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  SENDING: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  SENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

export const RECIPIENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  QUEUED: "Na fila",
  SENT: "Enviado",
  DELIVERED: "Entregue",
  READ: "Lido",
  FAILED: "Falhou",
  SKIPPED: "Ignorado",
};
