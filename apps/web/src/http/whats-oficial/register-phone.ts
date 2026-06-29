"use server";

import { graphFetch } from "./client";
import type { RegisterPhoneResponse } from "./types";

interface RegisterPhoneInput {
  phoneNumberId: string;
  pin: string;
  accessToken: string;
}

/**
 * Registra um número de telefone na Cloud API com 2FA (PIN 6 dígitos).
 *
 * Endpoint Meta:
 *   POST /v23.0/{phone_number_id}/register
 *   { "messaging_product": "whatsapp", "pin": "<6_DIGITS>" }
 *
 * Resposta: `{ "success": true }`.
 *
 * O PIN é usado pelo Meta como salvaguarda contra hijack do número — se
 * alguém mais tentar re-registrar, vai precisar do PIN. Na NASA, o PIN é
 * gerado server-side (`crypto.randomInt`) no `onboard.ts`, usado uma única
 * vez aqui, e descartado — sem custódia (decisão #3 do plano Fase 7).
 *
 * Pra fluxo Coexistence (WhatsApp Business app), esta chamada DEVE ser
 * pulada — o número já está registrado no app móvel do cliente.
 */
export async function registerPhone(
  input: RegisterPhoneInput,
): Promise<RegisterPhoneResponse> {
  return graphFetch<RegisterPhoneResponse>(
    `/${input.phoneNumberId}/register`,
    {
      method: "POST",
      accessToken: input.accessToken,
      body: {
        messaging_product: "whatsapp",
        pin: input.pin,
      },
    },
  );
}
