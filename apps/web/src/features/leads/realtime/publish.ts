import { realtimePublisher } from "@/lib/realtime";
import {
  boardLeadsChannelName,
  type BoardLeadsEvents,
  type BoardLeadsEventSource,
  type LeadChangedField,
} from "./board-leads-channel";

/**
 * Helpers de broadcast do board de leads.
 *
 * Publicam pela porta `RealtimePublisher` (@/lib/realtime) — não conhecem
 * Pusher nem qualquer lib. Tratamento de erro de transporte fica no adapter.
 */

/** Publica um evento tipado num canal de board. */
function publishBoardEvent<Event extends keyof BoardLeadsEvents>(
  trackingId: string,
  event: Event,
  payload: BoardLeadsEvents[Event],
) {
  return realtimePublisher.publish(
    boardLeadsChannelName(trackingId),
    event,
    payload,
  );
}

export async function publishLeadCreated(payload: {
  leadId: string;
  trackingId: string;
  statusId: string;
  source?: BoardLeadsEventSource;
}) {
  if (!payload.trackingId || !payload.statusId) return;

  await publishBoardEvent(payload.trackingId, "lead-created", {
    leadId: payload.leadId,
    trackingId: payload.trackingId,
    statusId: payload.statusId,
    source: payload.source ?? "form",
    at: new Date().toISOString(),
  });
}

export async function publishLeadMoved(payload: {
  leadId: string;
  fromTrackingId: string | null;
  toTrackingId: string;
  fromStatusId: string | null;
  toStatusId: string;
  movedAt: string;
}) {
  if (!payload.toTrackingId) return;
  const body = { ...payload, source: "workflow" as const };

  await publishBoardEvent(payload.toTrackingId, "lead-moved", body);

  if (
    payload.fromTrackingId &&
    payload.fromTrackingId !== payload.toTrackingId
  ) {
    await publishBoardEvent(payload.fromTrackingId, "lead-moved", body);
  }
}

export async function publishLeadChanged(payload: {
  leadId: string;
  trackingId: string;
  statusId: string;
  fields: LeadChangedField[];
}) {
  if (!payload.trackingId || !payload.statusId || payload.fields.length === 0) {
    return;
  }

  await publishBoardEvent(payload.trackingId, "lead-changed", {
    ...payload,
    at: new Date().toISOString(),
    source: "workflow",
  });
}

export async function publishLeadClosed(payload: {
  leadId: string;
  trackingId: string;
  statusId: string;
  outcome: "WON" | "LOST";
}) {
  if (!payload.trackingId || !payload.statusId) return;

  await publishBoardEvent(payload.trackingId, "lead-closed", {
    ...payload,
    at: new Date().toISOString(),
    source: "workflow",
  });
}
