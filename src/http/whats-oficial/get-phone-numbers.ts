"use server";

import { graphFetch } from "./client";
import type { PhoneNumbersListResponse } from "./types";

interface GetPhoneNumbersInput {
  wabaId: string;
  accessToken: string;
  /** Override de fields. Default cobre o card de status da Fase 7.5. */
  fields?: string;
}

const DEFAULT_FIELDS = [
  "id",
  "display_phone_number",
  "verified_name",
  "code_verification_status",
  "quality_rating",
  "messaging_limit_tier",
  "platform_type",
].join(",");

/**
 * Lista todos os números de telefone associados a uma WABA.
 *
 * Endpoint Meta:
 *   GET /v23.0/{waba_id}/phone_numbers?fields=...
 *
 * Usado em duas situações:
 *  1. Pós-Embedded Signup, pra confirmar o `phone_number_id` retornado no
 *     `postMessage` e enriquecer com `display_phone_number`/`verified_name`
 *     que a UI mostra.
 *  2. Procedure `getMetaPhoneStatus(trackingId)` (Fase 7.5) chamada
 *     on-demand pelo painel pra ver `quality_rating` atual.
 */
export async function getPhoneNumbers(
  input: GetPhoneNumbersInput,
): Promise<PhoneNumbersListResponse> {
  const fields = input.fields ?? DEFAULT_FIELDS;
  const path = `/${input.wabaId}/phone_numbers?fields=${encodeURIComponent(fields)}`;
  return graphFetch<PhoneNumbersListResponse>(path, {
    method: "GET",
    accessToken: input.accessToken,
  });
}
