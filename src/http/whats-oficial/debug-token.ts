"use server";

import { graphFetch } from "./client";

// Confere a chave colada pelo cliente e descobre as contas WhatsApp (WABA)
// que ela alcança, via `granular_scopes` (spec 0040, RF-11).

export interface DebugTokenGranularScope {
  scope: string;
  target_ids?: string[];
}

export interface DebugTokenData {
  app_id?: string;
  type?: string;
  is_valid: boolean;
  /** 0 = não expira (token de usuário do sistema "Nunca"). */
  expires_at?: number;
  scopes?: string[];
  granular_scopes?: DebugTokenGranularScope[];
  error?: { message?: string };
}

interface DebugTokenInput {
  inputToken: string;
  appId: string;
  appSecret: string;
}

export async function debugToken(input: DebugTokenInput): Promise<DebugTokenData> {
  const query = new URLSearchParams({ input_token: input.inputToken });
  const response = await graphFetch<{ data: DebugTokenData }>(`/debug_token?${query.toString()}`, {
    method: "GET",
    accessToken: `${input.appId}|${input.appSecret}`,
  });
  return response.data;
}
