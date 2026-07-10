import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch, FocusNfeHttpError } from "./client";
import type { FocusCancelResponse } from "./types";

export async function cancelarNfse(
  ref: string,
  justificativa: string,
  environment: FiscalEnvironment,
  companyToken: string,
): Promise<void> {
  const result = await focusFetch<FocusCancelResponse>({
    method: "DELETE",
    path: `/nfse/${encodeURIComponent(ref)}`,
    body: { justificativa },
    environment,
    token: companyToken,
  });

  if (result.status === "erro_cancelamento") {
    const firstError = result.erros?.[0];
    const message = firstError?.mensagem ?? "Cancelamento recusado pela prefeitura";
    throw new FocusNfeHttpError(200, firstError?.codigo ?? null, message);
  }
}
