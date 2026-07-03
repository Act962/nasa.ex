import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusNfseResponse } from "./types";

export async function consultarNfseNacional(
  ref: string,
  environment: FiscalEnvironment,
  companyToken: string,
): Promise<FocusNfseResponse> {
  return focusFetch<FocusNfseResponse>({
    method: "GET",
    path: `/nfsen/${encodeURIComponent(ref)}`,
    environment,
    token: companyToken,
  });
}
