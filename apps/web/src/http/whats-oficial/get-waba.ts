"use server";

import { graphFetch } from "./client";
import type { WabaInfo } from "./types";

interface GetWabaInput {
  wabaId: string;
  accessToken: string;
  /** Override de fields. Default cobre metadados básicos do onboarding. */
  fields?: string;
}

const DEFAULT_FIELDS = [
  "id",
  "name",
  "currency",
  "timezone_id",
  "message_template_namespace",
  "account_review_status",
].join(",");

/**
 * Lê metadados de uma WABA (WhatsApp Business Account).
 *
 * Endpoint Meta:
 *   GET /v23.0/{waba_id}?fields=...
 *
 * Usado pós-Embedded Signup pra:
 *  - Confirmar que a `waba_id` retornada no postMessage corresponde a uma
 *    WABA válida e que o token tem acesso a ela.
 *  - Capturar `name` / `currency` / `timezone_id` pra exibir no card de
 *    status do tracking (Fase 7.5).
 */
export async function getWaba(input: GetWabaInput): Promise<WabaInfo> {
  const fields = input.fields ?? DEFAULT_FIELDS;
  const path = `/${input.wabaId}?fields=${encodeURIComponent(fields)}`;
  return graphFetch<WabaInfo>(path, {
    method: "GET",
    accessToken: input.accessToken,
  });
}
