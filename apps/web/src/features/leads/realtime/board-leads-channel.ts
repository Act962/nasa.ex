/**
 * Descritor do canal de realtime do board de leads.
 *
 * Substitui o antigo canal Inngest (`src/inngest/channels/board-leads.ts`).
 * Define o nome do canal Pusher e o contrato tipado evento → payload. O
 * domínio publica/consome por aqui; a lib de transporte fica escondida atrás
 * da porta em `@/lib/realtime`.
 */

/** Prefixo do canal privado. Pusher não aceita `:` em nomes → usamos `-`. */
export const BOARD_LEADS_CHANNEL_PREFIX = "private-board-leads-";

export const boardLeadsChannelName = (trackingId: string) =>
  `${BOARD_LEADS_CHANNEL_PREFIX}${trackingId}`;

/** Extrai o trackingId de um nome de canal do board (ou null se não casar). */
export const boardLeadsTrackingIdFromChannel = (
  channel: string,
): string | null => {
  if (!channel.startsWith(BOARD_LEADS_CHANNEL_PREFIX)) return null;
  const trackingId = channel.slice(BOARD_LEADS_CHANNEL_PREFIX.length);
  return trackingId || null;
};

export type LeadChangedField = "tag" | "temperature" | "responsible";

/** Origem que disparou o evento do board. */
export type BoardLeadsEventSource = "form" | "workflow";

/** Contrato tipado: cada evento do board e o payload que carrega. */
export type BoardLeadsEvents = {
  "lead-created": {
    leadId: string;
    trackingId: string;
    statusId: string;
    at: string;
    source: BoardLeadsEventSource;
  };
  "lead-moved": {
    leadId: string;
    fromTrackingId: string | null;
    toTrackingId: string;
    fromStatusId: string | null;
    toStatusId: string;
    movedAt: string;
    source: "workflow";
  };
  "lead-changed": {
    leadId: string;
    trackingId: string;
    statusId: string;
    fields: LeadChangedField[];
    at: string;
    source: "workflow";
  };
  "lead-closed": {
    leadId: string;
    trackingId: string;
    statusId: string;
    outcome: "WON" | "LOST";
    at: string;
    source: "workflow";
  };
};

export type BoardLeadsEventName = keyof BoardLeadsEvents;
