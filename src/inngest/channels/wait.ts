import { channel, topic } from "@inngest/realtime";

export const WAIT_CHANNEL_NAME = "wait-execution";

export const waitChannel = channel(WAIT_CHANNEL_NAME).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
