import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusMunicipio, FocusMunicipioParams } from "./types";

type FocusMunicipioRaw = {
  codigo_municipio: string;
  nome_municipio: string;
  sigla_uf: string;
  nome_uf?: string;
  nfse_habilitada?: boolean;
  status_nfse?: string;
};

export async function listarMunicipios(
  params: FocusMunicipioParams,
  environment: FiscalEnvironment,
): Promise<FocusMunicipio[]> {
  const searchParams = new URLSearchParams();
  if (params.nome) searchParams.set("nome", params.nome);
  if (params.uf) searchParams.set("sigla_uf", params.uf);
  if (params.codigo_ibge) searchParams.set("codigo_municipio", params.codigo_ibge);
  if (params.habilita_nfse) searchParams.set("nfse_habilitada", "true");

  const query = searchParams.toString();

  const raw = await focusFetch<FocusMunicipioRaw[]>({
    method: "GET",
    path: `/municipios${query ? `?${query}` : ""}`,
    environment,
  });

  return raw.map((item) => ({
    codigo_ibge: item.codigo_municipio,
    nome: item.nome_municipio,
    uf: item.sigla_uf,
    nome_uf: item.nome_uf,
    habilita_nfse: item.nfse_habilitada,
  }));
}
