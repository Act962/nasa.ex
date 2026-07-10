import { focusFetch } from "./client";
import type { FocusEmpresaPayload, FocusEmpresaResponse } from "./types";

// Gerenciamento de empresa é sempre no ambiente de produção da Focus NFe.
// O endpoint /empresas não existe na URL de homologação.
export async function cadastrarEmpresa(
  payload: FocusEmpresaPayload,
  dryRun = false,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "POST",
    path: dryRun ? "/empresas?dry_run=1" : "/empresas",
    body: payload,
    environment: "PRODUCAO",
  });
}
