/** Rótulos/variantes de UI pros status de campanha e destinatário. */

export const BROADCAST_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  SENDING: "Enviando",
  SENT: "Enviada",
  PAUSED: "Pausada",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
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
