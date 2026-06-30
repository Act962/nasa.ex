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

function resolveMasterToken(environment: FiscalEnvironment): string {
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

function buildBasicAuth(environment: FiscalEnvironment, token?: string): string {
  const resolved = token ?? resolveMasterToken(environment);
  return `Basic ${Buffer.from(`${resolved}:`).toString("base64")}`;
}

type FocusErrorBody = {
  mensagem_erros?: string[];
  msg?: string;
  mensagem?: string;
  erros?: Array<{ mensagem?: string }>;
};

function extractFocusErrorMessage(text: string, status: number): string {
  let parsed: FocusErrorBody | null = null;
  try {
    parsed = text ? (JSON.parse(text) as FocusErrorBody) : null;
  } catch {
    parsed = null;
  }
  return (
    parsed?.mensagem_erros?.[0] ??
    parsed?.erros?.[0]?.mensagem ??
    parsed?.mensagem ??
    parsed?.msg ??
    text ??
    `Focus NFe HTTP ${status}`
  );
}

export type FocusFetchOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  environment: FiscalEnvironment;
  /** Per-company token. When omitted, falls back to the master env token. */
  token?: string;
};

export async function focusFetch<T>(opts: FocusFetchOptions): Promise<T> {
  const baseUrl = BASE_URLS[opts.environment];
  const url = `${baseUrl}${opts.path}`;
  const bodyJson =
    opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

  // Resolve auth before the try/catch so token errors propagate as MISSING_TOKEN,
  // not as false NETWORK errors.
  const authHeader = buildBasicAuth(opts.environment, opts.token);

  let response: Response;
  try {
    response = await fetch(url, {
      method: opts.method,
      headers: {
        Authorization: authHeader,
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
    throw new FocusNfeHttpError(
      response.status,
      null,
      extractFocusErrorMessage(text, response.status),
      text.slice(0, 500),
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

