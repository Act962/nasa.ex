"use server";
import { uazapiFetch } from "./client";
import { FindChatsPayload, FindChatsResponse } from "./types";

export async function findChats(
  token: string,
  data: FindChatsPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<FindChatsResponse>("/chat/find", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
