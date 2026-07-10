import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { NfseNacionalPayload, FocusNfseResponse } from "./types";

export async function emitirNfseNacional(
  ref: string,
  payload: NfseNacionalPayload,
  environment: FiscalEnvironment,
  companyToken: string,
): Promise<FocusNfseResponse> {
  return focusFetch<FocusNfseResponse>({
    method: "POST",
    path: `/nfsen?ref=${encodeURIComponent(ref)}`,
    body: payload,
    environment,
    token: companyToken,
  });
}
