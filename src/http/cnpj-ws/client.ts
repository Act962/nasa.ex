const BASE_URL = "https://publica.cnpj.ws/cnpj";
const TIMEOUT_MS = 10_000;

export class CnpjWsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CnpjWsError";
  }
}

export type CnpjWsResponse = {
  razao_social: string;
  simples: { simples: "Sim" | "Não" | null } | null;
  estabelecimento: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
    estado: { sigla: string } | null;
    cidade: { ibge_id: number; nome: string } | null;
  };
};

export async function consultarCnpj(cnpj: string): Promise<CnpjWsResponse> {
  const digits = cnpj.replace(/\D/g, "");

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${digits}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new CnpjWsError(0, `CNPJ.ws não respondeu em ${TIMEOUT_MS}ms`);
    }
    throw new CnpjWsError(
      0,
      err instanceof Error ? err.message : "Falha na requisição ao CNPJ.ws",
    );
  }

  if (response.status === 404) throw new CnpjWsError(404, "CNPJ não encontrado");
  if (response.status === 429) throw new CnpjWsError(429, "Limite de consultas atingido, aguarde 1 minuto");
  if (!response.ok) throw new CnpjWsError(response.status, `CNPJ.ws HTTP ${response.status}`);

  return response.json() as Promise<CnpjWsResponse>;
}
