import { focusFetch } from "./client";
import type { FocusEmpresaResponse } from "./types";

export async function buscarEmpresasPorCnpj(
  cnpj: string,
): Promise<FocusEmpresaResponse[]> {
  return focusFetch<FocusEmpresaResponse[]>({
    method: "GET",
    path: `/empresas?cnpj=${cnpj.replace(/\D/g, "")}`,
    environment: "PRODUCAO",
  });
}
