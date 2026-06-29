import "dotenv/config";
import { signRequest } from "./sign";
import { CommentsHttpError, type CommentsConfig } from "./types";

const DEFAULT_TIMEOUT_MS = Number(
  process.env.COMMENTS_REQUEST_TIMEOUT_MS ?? 10_000,
);

export type CommentsTrpcKind = "query" | "mutation";

function resolveBaseUrl(cfg: CommentsConfig): string {
  const base = cfg.baseUrl ?? process.env.COMMENTS_APP_BASE_URL;
  if (!base) {
    throw new CommentsHttpError({
      status: 0,
      message: "COMMENTS_APP_BASE_URL ausente e config.baseUrl não setado",
      code: "COMMENTS_BASE_URL_MISSING",
    });
  }
  return base.replace(/\/$/, "");
}

/**
 * Invoca uma procedure tRPC do comments-app via S2S HMAC.
 *
 * Para query: GET /api/trpc/<procedure>?batch=0&input=<json>
 * Para mutation: POST /api/trpc/<procedure>?batch=0 com body { json: input }
 *
 * O comments-app verifica HMAC sobre `METHOD\npathname\nrawBody\ntimestamp`.
 * Pathname inclui apenas o caminho, sem query string.
 */
export async function callTrpc<T>(
  cfg: CommentsConfig,
  procedure: string,
  kind: CommentsTrpcKind,
  input: unknown,
  opts?: { signal?: AbortSignal },
): Promise<T> {
  const baseUrl = resolveBaseUrl(cfg);
  const method: "GET" | "POST" = kind === "query" ? "GET" : "POST";
  const pathBase = `/api/trpc/${procedure}`;

  let url: string;
  let rawBody = "";

  if (kind === "query") {
    const params = new URLSearchParams({ batch: "0" });
    if (input !== undefined) {
      params.set("input", JSON.stringify({ json: input }));
    }
    url = `${baseUrl}${pathBase}?${params.toString()}`;
  } else {
    url = `${baseUrl}${pathBase}?batch=0`;
    rawBody = JSON.stringify(input === undefined ? {} : { json: input });
  }

  const timestamp = String(Date.now());
  const signature = signRequest({
    method,
    path: pathBase,
    body: rawBody,
    timestamp,
    secret: cfg.secret,
  });

  const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const signal = opts?.signal
    ? AbortSignal.any([opts.signal, timeoutSignal])
    : timeoutSignal;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Comments-Api-Key": cfg.apiKey,
        "X-Comments-User-Id": cfg.userId,
        "X-Comments-Timestamp": timestamp,
        "X-Comments-Signature": signature,
      },
      body: method === "GET" ? undefined : rawBody,
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new CommentsHttpError({
        status: 0,
        message: `comments-app request timed out after ${DEFAULT_TIMEOUT_MS}ms`,
        code: "COMMENTS_TIMEOUT",
      });
    }
    throw new CommentsHttpError({
      status: 0,
      message: err instanceof Error ? err.message : "comments-app request failed",
      code: "COMMENTS_NETWORK",
    });
  }

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    let parsed: { message?: string; code?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    throw new CommentsHttpError({
      status: response.status,
      message:
        parsed?.message ??
        (text || `comments-app HTTP ${response.status} ${response.statusText}`),
      code: parsed?.code ?? null,
      bodySnippet: text ? text.slice(0, 500) : null,
    });
  }

  if (response.status === 204 || !text) {
    return undefined as T;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CommentsHttpError({
      status: response.status,
      message: "comments-app retornou JSON inválido",
      code: "COMMENTS_INVALID_JSON",
      bodySnippet: text.slice(0, 500),
    });
  }

  // Envelope tRPC (não-batched): { result: { data: <T> } }
  // Caso ocorra erro estruturado: { error: { json: { message } } }
  const envelope = parsed as {
    result?: { data?: T };
    error?: { json?: { message?: string; code?: string } };
  };

  if (envelope.error) {
    throw new CommentsHttpError({
      status: response.status,
      message: envelope.error.json?.message ?? "tRPC error",
      code: envelope.error.json?.code ?? null,
      bodySnippet: text.slice(0, 500),
    });
  }

  return (envelope.result?.data as T) ?? (undefined as T);
}
