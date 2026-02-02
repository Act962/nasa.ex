"use server";
import { uazapiFetch } from "./client";
import { DownloadFilePayload, DownloadFileResponse } from "./types";

export async function downloadFile({
  token,
  data,
  baseUrl,
}: {
  token: string;
  data: DownloadFilePayload;
  baseUrl?: string;
}) {
  return await uazapiFetch<DownloadFileResponse>("/message/download", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
