"use server";
import { graphFetch } from "./client";
import type { SendContactInput, SendMessageResponse } from "./types";

/**
 * Envia um contato (vCard) via Cloud API.
 *
 * Implementação mínima da Fase 1 — só nome + telefone (+ opcionalmente
 * organização e email). O formato completo da Meta aceita endereços, URLs,
 * birthday, etc. — adicionamos conforme a UI demandar nas fases finais.
 */
export async function sendOfficialContact(
  accessToken: string,
  phoneNumberId: string,
  input: SendContactInput,
): Promise<SendMessageResponse> {
  const contactPayload: Record<string, unknown> = {
    name: { formatted_name: input.fullName, first_name: input.fullName },
    phones: [{ phone: input.phoneNumber, type: "CELL" }],
  };

  if (input.organization) {
    contactPayload.org = { company: input.organization };
  }
  if (input.email) {
    contactPayload.emails = [{ email: input.email, type: "WORK" }];
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "contacts",
    contacts: [contactPayload],
  };

  if (input.replyToWamid) {
    body.context = { message_id: input.replyToWamid };
  }

  return graphFetch<SendMessageResponse>(`/${phoneNumberId}/messages`, {
    method: "POST",
    accessToken,
    body,
  });
}
