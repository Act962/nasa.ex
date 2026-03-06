import { channel, topic } from "@inngest/realtime";

export const RESPONSIBLE_CHANNEL_NAME = "responsible-execution";

export const responsibleChannel = channel(RESPONSIBLE_CHANNEL_NAME).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
