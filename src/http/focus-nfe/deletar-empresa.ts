import { focusFetch } from "./client";

// Gerenciamento de empresa é sempre no ambiente de produção da Focus NFe.
export async function deletarEmpresa(focusEmpresaId: number): Promise<void> {
  return focusFetch<void>({
    method: "DELETE",
    path: `/empresas/${focusEmpresaId}`,
    environment: "PRODUCAO",
  });
}
