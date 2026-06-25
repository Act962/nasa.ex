import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusEmpresaResponse } from "./types";

export async function consultarEmpresa(
  cnpj: string,
  environment: FiscalEnvironment,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "GET",
    path: `/empresas/${cnpj.replace(/\D/g, "")}`,
    environment,
  });
}
