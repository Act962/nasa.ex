import { ViaCepError } from "./types";

const VIACEP_BASE_URL = "https://viacep.com.br/ws";
const TIMEOUT_MS = 8_000;

export async function viaCepFetch<T>(cep: string): Promise<T> {
  const sanitizedCep = cep.replace(/\D/g, "");

  if (sanitizedCep.length !== 8) {
    throw new ViaCepError(
      400,
      `CEP inválido: "${cep}". Informe 8 dígitos numéricos.`,
    );
  }

  const url = `${VIACEP_BASE_URL}/${sanitizedCep}/json/`;
  const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: timeoutSignal });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ViaCepError(0, `ViaCEP não respondeu em ${TIMEOUT_MS}ms`);
    }
    throw new ViaCepError(
      0,
      err instanceof Error ? err.message : "Falha na requisição ao ViaCEP",
    );
  }

  if (response.status === 400) {
    throw new ViaCepError(400, `CEP inválido: "${cep}"`);
  }

  if (!response.ok) {
    throw new ViaCepError(
      response.status,
      `ViaCEP HTTP ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}
