"use client";

import { useCallback } from "react";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { fetchVideoUploadToken } from "../lib/video-upload-realtime-tokens";

export function useVideoUploadRealtime(uploadId: string | null) {
  const refreshToken = useCallback(
    () =>
      uploadId
        ? fetchVideoUploadToken(uploadId)
        : Promise.resolve(null as never),
    [uploadId],
  );

  const { data } = useInngestSubscription({
    refreshToken,
    enabled: !!uploadId,
  });

  // Pega o evento mais recente por createdAt (pode chegar fora de ordem)
  const latest = [...data]
    .filter((m) => m.kind === "data")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

  if (!latest || latest.kind !== "data") {
    return { progressPct: 0, isCompleted: false, videoUrl: null, hasFailed: false };
  }

  if (latest.topic === "progress") {
    const d = latest.data as { progressPct: number; completedParts: number; totalParts: number };
    return { progressPct: d.progressPct, isCompleted: false, videoUrl: null, hasFailed: false };
  }

  if (latest.topic === "completed") {
    const d = latest.data as { videoUrl: string };
    return { progressPct: 100, isCompleted: true, videoUrl: d.videoUrl, hasFailed: false };
  }

  if (latest.topic === "failed") {
    return { progressPct: 0, isCompleted: false, videoUrl: null, hasFailed: true };
  }

  return { progressPct: 0, isCompleted: false, videoUrl: null, hasFailed: false };
}
