/**
 * Helper para emitir eventos de rastreamento ao Inngest.
 * Fire-and-forget — erros nao propagam para o caller.
 */

import { inngest } from "@/inngest/client";

export interface TrackingEvent {
  userId: string;
  orgId: string;
  action: string;
  metadata?: Record<string, unknown>;
  source: "route" | "cron" | "webhook";
}

export async function emitTracking(event: TrackingEvent): Promise<void> {
  try {
    await inngest.send({
      name: "user/action.tracked",
      data: event,
    });
  } catch (e) {
    console.error("[tracking-emitter] failed:", e);
  }
}

export async function emitTrackingBatch(events: TrackingEvent[]): Promise<void> {
  if (events.length === 0) return;
  try {
    await inngest.send(
      events.map((ev) => ({ name: "user/action.tracked" as const, data: ev })),
    );
  } catch (e) {
    console.error("[tracking-emitter] batch failed:", e);
  }
}
