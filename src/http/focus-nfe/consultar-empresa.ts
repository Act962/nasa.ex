import { focusFetch } from "./client";
import type { FocusEmpresaResponse } from "./types";

// Gerenciamento de empresa é sempre no ambiente de produção da Focus NFe.
export async function consultarEmpresa(
  focusEmpresaId: number,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "GET",
    path: `/empresas/${focusEmpresaId}`,
    environment: "PRODUCAO",
  });
}
