"use server";

import { graphFetch } from "./client";

// Confirma o código que chegou no número — prova de posse para a Meta.

interface VerifyCodeInput {
  phoneNumberId: string;
  accessToken: string;
  code: string;
}

export async function verifyCode(input: VerifyCodeInput): Promise<{ success: boolean }> {
  return graphFetch<{ success: boolean }>(`/${input.phoneNumberId}/verify_code`, {
    method: "POST",
    accessToken: input.accessToken,
    body: { code: input.code },
  });
}
