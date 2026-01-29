"use server";

import { uazapiFetch } from "./client";
import { WebhookPayload, WebhookResponse } from "./types";

interface configureWebhookProps {
  token: string;
  data: WebhookPayload;
  baseUrl?: string;
}

export async function configureWebhook({
  token,
  data,
  baseUrl,
}: configureWebhookProps) {
  return await uazapiFetch<WebhookResponse>("/webhook", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
