import { channel, topic } from "@inngest/realtime";

export const BOARD_LEADS_CHANNEL_PREFIX = "board-leads";

export type LeadChangedField = "tag" | "temperature" | "responsible";

export const boardLeadsChannel = channel(
  (trackingId: string) => `${BOARD_LEADS_CHANNEL_PREFIX}:${trackingId}`,
)
  .addTopic(
    topic("lead-moved").type<{
      leadId: string;
      fromTrackingId: string | null;
      toTrackingId: string;
      fromStatusId: string | null;
      toStatusId: string;
      movedAt: string;
      source: "workflow";
    }>(),
  )
  .addTopic(
    topic("lead-changed").type<{
      leadId: string;
      trackingId: string;
      statusId: string;
      fields: LeadChangedField[];
      at: string;
      source: "workflow";
    }>(),
  )
  .addTopic(
    topic("lead-closed").type<{
      leadId: string;
      trackingId: string;
      statusId: string;
      outcome: "WON" | "LOST";
      at: string;
      source: "workflow";
    }>(),
  );
