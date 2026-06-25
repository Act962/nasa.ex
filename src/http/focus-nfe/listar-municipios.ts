import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusMunicipio, FocusMunicipioParams } from "./types";

export async function listarMunicipios(
  params: FocusMunicipioParams,
  environment: FiscalEnvironment,
): Promise<FocusMunicipio[]> {
  const searchParams = new URLSearchParams();
  if (params.nome) searchParams.set("nome", params.nome);
  if (params.uf) searchParams.set("uf", params.uf);
  if (params.codigo_ibge) searchParams.set("codigo_ibge", params.codigo_ibge);
  if (params.habilita_nfse) searchParams.set("habilita_nfse", "1");

  const query = searchParams.toString();

  console.error("listarMunicipios response:");

  const response = await focusFetch<FocusMunicipio[]>({
    method: "GET",
    path: `/municipios${query ? `?${query}` : ""}`,
    environment,
  });

  return response;
}
