import "dotenv/config";
import { signRequest } from "./sign";
import { NerpHttpError, type NerpOrgConfig } from "./types";

const DEFAULT_TIMEOUT_MS = Number(process.env.NERP_REQUEST_TIMEOUT_MS ?? 10_000);

export type NerpFetchOptions = {
  cfg: NerpOrgConfig;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function resolveBaseUrl(cfg: NerpOrgConfig): string {
  const base = cfg.baseUrl ?? process.env.NERP_BASE_URL;
  if (!base) {
    throw new NerpHttpError({
      status: 0,
      message: "NERP_BASE_URL ausente e config.baseUrl não setado",
      code: "NERP_BASE_URL_MISSING",
    });
  }
  return base.replace(/\/$/, "");
}

export async function nerpFetch<T>(opts: NerpFetchOptions): Promise<T> {
  const method = opts.method ?? "POST";
  const baseUrl = resolveBaseUrl(opts.cfg);
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  const url = `${baseUrl}${path}`;
  const bodyJson = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const timestamp = String(Date.now());

  const signature = signRequest({
    method,
    path,
    body: bodyJson,
    timestamp,
    secret: opts.cfg.secret,
  });

  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, timeoutSignal])
    : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Nerp-Api-Key": opts.cfg.apiKey,
        "X-Nerp-Org-Id": opts.cfg.nerpOrgId,
        "X-Nerp-Timestamp": timestamp,
        "X-Nerp-Signature": signature,
      },
      body: method === "GET" ? undefined : bodyJson,
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new NerpHttpError({
        status: 0,
        message: `nerp request timed out after ${DEFAULT_TIMEOUT_MS}ms`,
        code: "NERP_TIMEOUT",
      });
    }
    throw new NerpHttpError({
      status: 0,
      message: err instanceof Error ? err.message : "nerp request failed",
      code: "NERP_NETWORK",
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let parsed: { message?: string; code?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    throw new NerpHttpError({
      status: response.status,
      message:
        parsed?.message ??
        (text || `nerp HTTP ${response.status} ${response.statusText}`),
      code: parsed?.code ?? null,
      bodySnippet: text ? text.slice(0, 500) : null,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
