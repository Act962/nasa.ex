import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusEmpresaPayload, FocusEmpresaResponse } from "./types";

export async function cadastrarEmpresa(
  payload: FocusEmpresaPayload,
  environment: FiscalEnvironment,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "POST",
    path: "/empresas",
    body: payload,
    environment,
  });
}
