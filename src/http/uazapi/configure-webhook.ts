"use server";

import { uazapiFetch } from "./client";
import { WebhookPayload, WebhookResponse } from "./types";

export async function configureWebhook(
  token: string,
  data: WebhookPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<WebhookResponse>("/webhook", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
