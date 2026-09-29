"use server";

import { graphFetch } from "./client";

// Configura o webhook do app do cliente (callback + campo "messages") — o
// passo 34 do guia, feito por API com o token do app (APP_ID|APP_SECRET).
// A Meta faz um GET de verificação na callback antes de aceitar.

interface SubscribeAppWebhookInput {
  appId: string;
  appSecret: string;
  callbackUrl: string;
  verifyToken: string;
}

export async function subscribeAppWebhook(input: SubscribeAppWebhookInput): Promise<{ success: boolean }> {
  return graphFetch<{ success: boolean }>(`/${input.appId}/subscriptions`, {
    method: "POST",
    accessToken: `${input.appId}|${input.appSecret}`,
    body: {
      object: "whatsapp_business_account",
      callback_url: input.callbackUrl,
      verify_token: input.verifyToken,
      fields: "messages",
    },
  });
}
