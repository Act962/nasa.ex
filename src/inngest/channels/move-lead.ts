import { channel, topic } from "@inngest/realtime";

export const MOVE_LEAD_CHANNEL_NAME = "move-lead-execution";

export const moveLeadChannel = channel(MOVE_LEAD_CHANNEL_NAME).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
