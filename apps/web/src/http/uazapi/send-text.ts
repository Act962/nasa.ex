"use server";
import { uazapiFetch } from "./client";
import { SendTextPayload, SendTextResponse } from "./types";

export async function sendText(
  token: string,
  data: SendTextPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<SendTextResponse>("/send/text", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
