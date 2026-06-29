import { channel, topic } from "@inngest/realtime";

export const TAG_CHANNEL_NAME = "tag-execution";

export const tagChannel = channel(TAG_CHANNEL_NAME).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
