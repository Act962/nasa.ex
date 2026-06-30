import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { NfsePayload, FocusNfseResponse } from "./types";

export async function emitirNfse(
  ref: string,
  payload: NfsePayload,
  environment: FiscalEnvironment,
  companyToken: string,
): Promise<FocusNfseResponse> {
  return focusFetch<FocusNfseResponse>({
    method: "POST",
    path: `/nfse?ref=${encodeURIComponent(ref)}`,
    body: payload,
    environment,
    token: companyToken,
  });
}
