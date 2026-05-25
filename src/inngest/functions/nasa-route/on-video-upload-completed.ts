import { inngest } from "@/inngest/client";
import { videoUploadChannel } from "@/inngest/channels/nasa-route-video-upload";

export const onVideoUploadCompleted = inngest.createFunction(
  { id: "nasa-route/on-video-upload-completed", retries: 2 },
  {
    event: "nasa-route/video.upload.completed",
    channels: [(event: { data: { uploadId: string } }) => videoUploadChannel(event.data.uploadId)],
  },
  async ({ event, publish }) => {
    const { uploadId, videoUrl } = event.data;

    await publish(videoUploadChannel(uploadId), {
      topic: "completed",
      data: { uploadId, videoUrl },
    });
  },
);
