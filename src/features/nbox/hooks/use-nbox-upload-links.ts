"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/lib/orpc";
import { uploadNboxFiles, type NboxUploadProgress, type NboxUploadSummary } from "../utils/upload-files";

// Link de envio para cliente sem conta (spec 0149).

const UPLOADER_TOKEN_STORAGE_KEY = "nbox-uploader-token";

export const useCreateNboxUploadLink = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nbox.uploadLinks.create.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.nbox.folders.key() }),
    }),
  );
};

export const useUpdateNboxUploadLink = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nbox.uploadLinks.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.nbox.folders.key() });
        queryClient.invalidateQueries({ queryKey: orpc.nbox.items.key() });
      },
    }),
  );
};

function createUploaderToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

let cachedUploaderToken: string | null = null;

function readUploaderToken(): string {
  if (cachedUploaderToken) return cachedUploaderToken;
  let storedToken: string | null = null;
  try {
    storedToken = window.localStorage.getItem(UPLOADER_TOKEN_STORAGE_KEY);
  } catch {
    storedToken = null;
  }
  const token = storedToken && storedToken.length >= 32 ? storedToken : createUploaderToken();
  if (token !== storedToken) {
    try {
      window.localStorage.setItem(UPLOADER_TOKEN_STORAGE_KEY, token);
    } catch {
      // Navegador sem storage: a lista some ao recarregar, o envio continua funcionando.
    }
  }
  cachedUploaderToken = token;
  return token;
}

const subscribeToNothing = () => () => {};

/** Código deste navegador: é ele que diz quais arquivos o cliente enviou (RF-4). No servidor é null. */
export function useUploaderToken(): string | null {
  return useSyncExternalStore(subscribeToNothing, readUploaderToken, () => null);
}

export const usePublicNboxUploadLink = (uploadToken: string, uploaderToken: string | null) =>
  useQuery({
    ...orpc.nbox.uploadLinks.public.get.queryOptions({ input: { uploadToken, uploaderToken: uploaderToken ?? "" } }),
    enabled: !!uploaderToken,
    retry: false,
  });

export function usePublicNboxUpload(uploadToken: string, uploaderToken: string | null) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<NboxUploadProgress | null>(null);

  const uploadFiles = useCallback(
    async (files: File[], senderName: string): Promise<NboxUploadSummary> => {
      if (!uploaderToken) return { uploadedCount: 0, failures: [] };
      const summary = await uploadNboxFiles(
        files,
        {
          start: (file) => client.nbox.uploadLinks.public.startUpload({ uploadToken, ...file }),
          complete: (upload) =>
            client.nbox.uploadLinks.public.completeUpload({ uploadToken, uploaderToken, senderName, ...upload }),
        },
        setProgress,
      );
      setProgress(null);
      if (summary.uploadedCount > 0) {
        await client.nbox.uploadLinks.public.finish({ uploadToken, uploaderToken, senderName }).catch(() => null);
      }
      await queryClient.invalidateQueries({ queryKey: orpc.nbox.uploadLinks.public.get.key() });
      return summary;
    },
    [queryClient, uploadToken, uploaderToken],
  );

  return { uploadFiles, progress, isUploading: progress !== null };
}

export const useDeletePublicNboxUpload = () => {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.nbox.uploadLinks.public.deleteUpload.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.nbox.uploadLinks.public.get.key() }),
    }),
  );
};
