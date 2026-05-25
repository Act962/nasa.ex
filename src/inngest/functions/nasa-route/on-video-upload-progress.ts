import { inngest } from "@/inngest/client";
import { videoUploadChannel } from "@/inngest/channels/nasa-route-video-upload";

export const onVideoUploadProgress = inngest.createFunction(
  { id: "nasa-route/on-video-upload-progress", retries: 0 },
  {
    event: "nasa-route/video.upload.part-done",
    channels: [(event: { data: { uploadId: string } }) => videoUploadChannel(event.data.uploadId)],
  },
  async ({ event, publish }) => {
    const { uploadId, progressPct, completedParts, totalParts } = event.data;

    await publish(videoUploadChannel(uploadId).progress({ uploadId, progressPct, completedParts, totalParts }));
  },
);
