"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/lib/orpc";
import { uploadNboxFiles, type NboxUploadProgress, type NboxUploadSummary } from "../utils/upload-files";

export type { NboxUploadProgress, NboxUploadSummary } from "../utils/upload-files";

export function useNboxUpload() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<NboxUploadProgress | null>(null);

  const uploadFiles = useCallback(
    async (files: File[], folderId: string | null): Promise<NboxUploadSummary> => {
      const summary = await uploadNboxFiles(
        files,
        {
          start: (file) => client.nbox.uploads.start({ folderId, ...file }),
          complete: (upload) => client.nbox.uploads.complete({ folderId, ...upload }),
        },
        setProgress,
      );
      setProgress(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.nbox.items.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.nbox.getStorage.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.nbox.transfers.key() }),
      ]);
      return summary;
    },
    [queryClient],
  );

  return { uploadFiles, progress, isUploading: progress !== null };
}
