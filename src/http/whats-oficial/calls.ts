"use server";
import { graphFetch } from "./client";

/**
 * Ações de chamada da Calling API (`POST /{phone-number-id}/calls`), spec 0086.
 *
 * `pre_accept` e `accept` levam a resposta de conexão de áudio (SDP) da empresa;
 * `reject` recusa sem tocar; `terminate` é obrigatório ao fim de toda chamada
 * atendida, mesmo quando o áudio já parou — é o que fecha a cobrança na Meta.
 */
export type OfficialCallAction = "pre_accept" | "accept" | "reject" | "terminate";

export async function sendOfficialCallAction(
  accessToken: string,
  phoneNumberId: string,
  params: { callId: string; action: OfficialCallAction; sdpAnswer?: string },
): Promise<void> {
  await graphFetch<unknown>(`/${phoneNumberId}/calls`, {
    method: "POST",
    accessToken,
    body: {
      messaging_product: "whatsapp",
      call_id: params.callId,
      action: params.action,
      ...(params.sdpAnswer ? { session: { sdp_type: "answer", sdp: params.sdpAnswer } } : {}),
    },
  });
}
