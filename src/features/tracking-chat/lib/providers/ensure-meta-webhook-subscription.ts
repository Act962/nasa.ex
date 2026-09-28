import "server-only";
import { subscribeApp } from "@/http/whats-oficial/subscribe-app";
import {
  decryptStoredMetaCredentialsPartial,
  type MetaCredentialsStored,
} from "./meta-credentials";

// Sem `POST /{waba_id}/subscribed_apps` a Meta não entrega nenhum evento da
// WABA ao webhook, mesmo com a URL verificada. Só o Embedded Signup fazia
// isso; credenciais coladas manualmente ficavam mudas (spec 0014).

export type MetaWebhookSubscriptionResult =
  | { status: "subscribed" }
  | { status: "missing_business_account_id" }
  | { status: "missing_credentials" }
  | { status: "failed"; detail: string };

export async function ensureMetaWebhookSubscription(
  stored: MetaCredentialsStored,
): Promise<MetaWebhookSubscriptionResult> {
  if (!stored.metaAccessToken || !stored.metaPhoneNumberId) {
    return { status: "missing_credentials" };
  }
  if (!stored.metaBusinessAccountId) {
    return { status: "missing_business_account_id" };
  }

  try {
    const credentials = decryptStoredMetaCredentialsPartial(stored);
    await subscribeApp({
      wabaId: stored.metaBusinessAccountId,
      accessToken: credentials.accessToken,
    });
    return { status: "subscribed" };
  } catch (error) {
    return {
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
