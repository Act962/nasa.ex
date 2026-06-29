import { channel, topic } from "@inngest/realtime";

export const SEND_MESSAGE_CHANNEL_NAME = "send-message-execution";

export const sendMessageChannel = channel(SEND_MESSAGE_CHANNEL_NAME).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
