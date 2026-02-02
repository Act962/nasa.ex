"use server";
import { uazapiFetch } from "./client";
import { SendMediaPayload, SendMediaResponse } from "./types";

export async function sendMedia(
  token: string,
  data: SendMediaPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<SendMediaResponse>("/send/media", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
