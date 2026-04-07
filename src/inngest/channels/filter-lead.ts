import { channel, topic } from "@inngest/realtime";

export const FILTER_LEAD_CHANNEL_NAME = "filter-lead-execution";

export const filterLeadChannel = channel(FILTER_LEAD_CHANNEL_NAME).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
