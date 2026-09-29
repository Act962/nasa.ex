"use server";

import { graphFetch } from "./client";

// Pede à Meta o código de verificação do número (SMS ou ligação).

interface RequestVerificationCodeInput {
  phoneNumberId: string;
  accessToken: string;
  codeMethod?: "SMS" | "VOICE";
}

export async function requestVerificationCode(input: RequestVerificationCodeInput): Promise<{ success: boolean }> {
  return graphFetch<{ success: boolean }>(`/${input.phoneNumberId}/request_code`, {
    method: "POST",
    accessToken: input.accessToken,
    body: { code_method: input.codeMethod ?? "SMS", language: "pt_BR" },
  });
}
