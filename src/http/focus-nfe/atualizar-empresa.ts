import { focusFetch } from "./client";
import type { FocusEmpresaPayload, FocusEmpresaResponse } from "./types";

// Gerenciamento de empresa é sempre no ambiente de produção da Focus NFe.
export async function atualizarEmpresa(
  focusEmpresaId: number,
  payload: Partial<FocusEmpresaPayload>,
): Promise<FocusEmpresaResponse> {
  return focusFetch<FocusEmpresaResponse>({
    method: "PUT",
    path: `/empresas/${focusEmpresaId}`,
    body: payload,
    environment: "PRODUCAO",
  });
}
