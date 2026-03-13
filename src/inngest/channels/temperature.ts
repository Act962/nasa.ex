import { channel, topic } from "@inngest/realtime";

export const TEMPERATURE_CHANNEL_NAME = "temperature-execution";

export const temperatureChannel = channel(TEMPERATURE_CHANNEL_NAME).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
