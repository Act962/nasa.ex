import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusEmpresaPayload, FocusEmpresaResponse } from "./types";

export async function atualizarEmpresa(
  cnpj: string,
  payload: Partial<FocusEmpresaPayload>,
  environment: FiscalEnvironment,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "PUT",
    path: `/empresas/${cnpj.replace(/\D/g, "")}`,
    body: payload,
    environment,
  });
}
