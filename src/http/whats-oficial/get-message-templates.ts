"use server";
import { graphFetch } from "./client";
import type { MessageTemplatesResponse } from "./types";

/**
 * Lista os message templates (HSM) de uma WhatsApp Business Account.
 *
 * `GET /{waba_id}/message_templates` — devolve TODOS os templates (qualquer
 * status). A filtragem por `APPROVED` fica na camada de domínio (oRPC), que
 * também faz o parse leve dos `components` pra UI.
 *
 * Ref: https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api
 */
export async function getMessageTemplates(
  accessToken: string,
  wabaId: string,
  options?: { limit?: number; after?: string },
): Promise<MessageTemplatesResponse> {
  const params = new URLSearchParams({
    fields: "id,name,language,status,category,components,quality_score",
    limit: String(options?.limit ?? 200),
  });
  if (options?.after) params.set("after", options.after);

  return graphFetch<MessageTemplatesResponse>(
    `/${wabaId}/message_templates?${params.toString()}`,
    { method: "GET", accessToken },
  );
}
