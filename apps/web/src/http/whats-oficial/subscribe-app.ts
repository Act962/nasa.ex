"use server";

import { graphFetch } from "./client";
import type { SubscribeAppResponse } from "./types";

interface SubscribeAppInput {
  wabaId: string;
  accessToken: string;
}

/**
 * Inscreve o App Meta da NASA pra receber webhooks da WABA do cliente.
 *
 * Endpoint Meta:
 *   POST /v23.0/{waba_id}/subscribed_apps
 *
 * Body vazio. O App inscrito é o associado ao `accessToken` (Business
 * Integration System User Access Token do cliente). Resposta:
 *   { "success": true }
 *
 * **Idempotência**: chamar duas vezes na mesma WABA retorna `success: true`
 * sem erro no caminho feliz. Esta função não trata erros especiais — quem
 * chama (`onboard.ts` na Fase 7.2) decide se um erro vira fatal ou se é
 * tratável (ex.: re-onboard idempotente).
 */
export async function subscribeApp(
  input: SubscribeAppInput,
): Promise<SubscribeAppResponse> {
  return graphFetch<SubscribeAppResponse>(`/${input.wabaId}/subscribed_apps`, {
    method: "POST",
    accessToken: input.accessToken,
  });
}
