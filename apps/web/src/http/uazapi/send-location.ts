"use server";
import { uazapiFetch } from "./client";
import { SendLocationPayload, SendLocationResponse } from "./types";

export async function sendLocation(
  token: string,
  data: SendLocationPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<SendLocationResponse>("/send/location", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
