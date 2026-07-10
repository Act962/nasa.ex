"use server";
import { graphFetch } from "./client";
import type {
  CreateMessageTemplateRequest,
  CreateMessageTemplateResponse,
} from "./types";

/**
 * Cria um message template (HSM) numa WhatsApp Business Account.
 *
 * `POST /{waba_id}/message_templates` — o template entra em análise da Meta
 * (`status: PENDING`) e só fica enviável quando `APPROVED`. Templates novos
 * levam ~10 min pra sincronizar com a conta de Ads antes de disparar via MM API.
 *
 * O payload (`components` + `example`) já vem pronto do domínio — este client
 * é HTTP burro. A montagem estruturada→Meta vive em
 * `src/features/campanhas/lib/build-template-components.ts`.
 *
 * Ref: https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api
 */
export async function createMessageTemplate(
  accessToken: string,
  wabaId: string,
  payload: CreateMessageTemplateRequest,
): Promise<CreateMessageTemplateResponse> {
  return graphFetch<CreateMessageTemplateResponse>(
    `/${wabaId}/message_templates`,
    {
      method: "POST",
      accessToken,
      body: payload,
    },
  );
}
