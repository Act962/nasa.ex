import { channel, topic } from "@inngest/realtime";

export const videoUploadChannel = channel(
  (uploadId: string) => `nasa-route-video-upload:${uploadId}`,
)
  .addTopic(
    topic("completed").type<{
      uploadId: string;
      videoUrl: string;
    }>(),
  )
  .addTopic(
    topic("failed").type<{
      uploadId: string;
      reason: string;
    }>(),
  );
