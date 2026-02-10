import { channel, topic } from "@inngest/realtime";

export const WIN_LOSS_CHANNEL_NAME = "win-loss-execution";

export const winLossChannel = channel(WIN_LOSS_CHANNEL_NAME).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
