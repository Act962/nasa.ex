"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken } from "@inngest/realtime";
import { videoUploadChannel } from "@/inngest/channels/nasa-route-video-upload";

export async function fetchVideoUploadToken(uploadId: string) {
  return getSubscriptionToken(inngest, {
    channel: videoUploadChannel(uploadId),
    topics: ["progress", "completed", "failed"],
  });
}
