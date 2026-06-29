import { channel, topic } from "@inngest/realtime";

export const videoUploadChannel = channel(
  (uploadId: string) => `nasa-route-video-upload:${uploadId}`,
)
  .addTopic(
    topic("progress").type<{
      uploadId: string;
      progressPct: number;
      completedParts: number;
      totalParts: number;
    }>(),
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
