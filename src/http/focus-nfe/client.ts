import type { FiscalEnvironment } from "@/generated/prisma/enums";

const TIMEOUT_MS = 15_000;

const BASE_URLS: Record<FiscalEnvironment, string> = {
  HOMOLOGACAO: "https://homologacao.focusnfe.com.br/v2",
  PRODUCAO: "https://api.focusnfe.com.br/v2",
};

export class FocusNfeHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string,
    public readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = "FocusNfeHttpError";
  }
}

function resolveToken(environment: FiscalEnvironment): string {
  const token =
    environment === "HOMOLOGACAO"
      ? process.env.FOCUS_NFE_TOKEN_HOMOLOGACAO
      : process.env.FOCUS_NFE_TOKEN_PRODUCAO;
  if (!token)
    throw new FocusNfeHttpError(
      0,
      "MISSING_TOKEN",
      `FOCUS_NFE_TOKEN_${environment} ausente`,
    );
  return token;
}

function buildBasicAuth(environment: FiscalEnvironment): string {
  const token = resolveToken(environment);
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

export type FocusFetchOptions = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  environment: FiscalEnvironment;
};

export async function focusFetch<T>(opts: FocusFetchOptions): Promise<T> {
  const baseUrl = BASE_URLS[opts.environment];
  const url = `${baseUrl}${opts.path}`;
  const bodyJson =
    opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method,
      headers: {
        Authorization: buildBasicAuth(opts.environment),
        ...(bodyJson ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
      },
      body: bodyJson,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new FocusNfeHttpError(
        0,
        "TIMEOUT",
        `Focus NFe request timed out after ${TIMEOUT_MS}ms`,
      );
    }
    throw new FocusNfeHttpError(
      0,
      "NETWORK",
      err instanceof Error ? err.message : "network error",
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let parsed: { mensagem_erros?: string[]; msg?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const message =
      (parsed?.mensagem_erros?.[0] ?? parsed?.msg ?? text) ||
      `Focus NFe HTTP ${response.status}`;
    throw new FocusNfeHttpError(
      response.status,
      null,
      message,
      text.slice(0, 500),
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function focusFetchMultipart(
  path: string,
  formData: FormData,
  environment: FiscalEnvironment,
): Promise<void> {
  const baseUrl = BASE_URLS[environment];
  const url = `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: buildBasicAuth(environment) },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new FocusNfeHttpError(
        0,
        "TIMEOUT",
        `Focus NFe multipart timed out`,
      );
    }
    throw new FocusNfeHttpError(
      0,
      "NETWORK",
      err instanceof Error ? err.message : "network error",
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let parsed: { mensagem_erros?: string[]; msg?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const message =
      (parsed?.mensagem_erros?.[0] ?? parsed?.msg ?? text) ||
      `Focus NFe HTTP ${response.status}`;
    throw new FocusNfeHttpError(
      response.status,
      null,
      message,
      text.slice(0, 500),
    );
  }
}
