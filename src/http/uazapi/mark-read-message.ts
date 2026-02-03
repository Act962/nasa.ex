"use server";
import { uazapiFetch } from "./client";
import { MarkReadPayload, MarkReadResponse } from "./types";

export async function markReadMessage(
  token: string,
  data: MarkReadPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<MarkReadResponse>("/chat/read", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
