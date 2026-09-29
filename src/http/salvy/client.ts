// Cliente da API da Salvy (números virtuais móveis para WhatsApp API).
// Doc: docs.salvy.com.br — base https://api.salvy.com.br, Bearer token;
// produção e sandbox pelo mesmo endereço, diferenciados pela chave.

import "server-only";

const DEFAULT_BASE_URL = "https://api.salvy.com.br";

export class SalvyConfigError extends Error {
  constructor() {
    super("Compra de número indisponível: SALVY_API_KEY não configurada.");
    this.name = "SalvyConfigError";
  }
}

export class SalvyApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = "SalvyApiError";
  }
}

export function isSalvyConfigured(): boolean {
  return Boolean(process.env.SALVY_API_KEY?.trim());
}

/** Mensagens da Salvy que o cliente entende (códigos da doc). */
const ERROR_MESSAGES: Record<string, string> = {
  "did-area-code-out-of-stock": "Sem números disponíveis nesse DDD agora. Escolha outro.",
  "company-tier-limit-exceeded": "Limite de números da conta atingido. Fale com a equipe.",
  "company-not-active": "Conta de números indisponível no momento. Fale com a equipe.",
  "company-has-pending-verification": "Conta de números em verificação. Fale com a equipe.",
};

export async function salvyFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = process.env.SALVY_API_KEY?.trim();
  if (!apiKey) throw new SalvyConfigError();
  const baseUrl = process.env.SALVY_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const responseBody = (await response.json().catch(() => ({}))) as { code?: string; message?: string } & T;
  if (!response.ok) {
    const code = typeof responseBody.code === "string" ? responseBody.code : null;
    throw new SalvyApiError(response.status, code, (code && ERROR_MESSAGES[code]) || responseBody.message || `Salvy respondeu HTTP ${response.status}.`);
  }
  return responseBody;
}
