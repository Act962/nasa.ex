import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusNfseResponse } from "./types";

export async function consultarNfse(
  ref: string,
  environment: FiscalEnvironment,
): Promise<FocusNfseResponse> {
  return focusFetch<FocusNfseResponse>({
    method: "GET",
    path: `/nfse/${encodeURIComponent(ref)}`,
    environment,
  });
}
