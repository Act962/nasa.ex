/**
 * Cliente único da Graph/Marketing API para as chamadas de anúncios (spec 0122, RF-1..RF-3).
 * Token só no cabeçalho, `appsecret_proof` quando houver segredo do app, tempo limite e erro tipado.
 */

import { createHmac } from "node:crypto";

export const META_GRAPH_VERSION = "v25.0";
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_PAGES = 5;

export type MetaGraphErrorKind = "token_invalid" | "permission" | "rate_limited" | "transient" | "unknown";

export interface MetaRequestAuth {
  accessToken: string;
  appSecret?: string | null;
}

export class MetaGraphError extends Error {
  readonly kind: MetaGraphErrorKind;
  readonly code: number | null;
  readonly subcode: number | null;
  /** Texto que pode ir ao usuário: nunca contém o token. */
  readonly userMessage: string;
  readonly fbtraceId: string | null;
  readonly retryAfterMinutes: number | null;

  constructor(params: {
    kind: MetaGraphErrorKind;
    message: string;
    code?: number | null;
    subcode?: number | null;
    userMessage?: string | null;
    fbtraceId?: string | null;
    retryAfterMinutes?: number | null;
  }) {
    super(params.message);
    this.name = "MetaGraphError";
    this.kind = params.kind;
    this.code = params.code ?? null;
    this.subcode = params.subcode ?? null;
    this.userMessage = params.userMessage?.trim() || describeMetaErrorKind(params.kind, params.retryAfterMinutes ?? null);
    this.fbtraceId = params.fbtraceId ?? null;
    this.retryAfterMinutes = params.retryAfterMinutes ?? null;
  }
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

export function classifyMetaError(code: number | null, isTransient: boolean): MetaGraphErrorKind {
  if (code === 190) return "token_invalid";
  if (code !== null && (RATE_LIMIT_CODES.has(code) || (code >= 80000 && code <= 80014))) return "rate_limited";
  if (code !== null && (code === 10 || (code >= 200 && code <= 299))) return "permission";
  if (isTransient || code === 1 || code === 2) return "transient";
  return "unknown";
}

export function describeMetaErrorKind(kind: MetaGraphErrorKind, retryAfterMinutes: number | null): string {
  switch (kind) {
    case "token_invalid":
      return "O token da Meta venceu ou foi revogado. Reconecte a conta nos Satélites.";
    case "permission":
      return "A conexão com a Meta não tem permissão para esta ação ou conta.";
    case "rate_limited":
      return retryAfterMinutes && retryAfterMinutes > 0
        ? `A Meta pediu para esperar ${retryAfterMinutes} min antes de novas consultas.`
        : "A Meta pediu para esperar um pouco antes de novas consultas.";
    case "transient":
      return "A Meta não respondeu agora. Tente de novo em instantes.";
    default:
      return "A Meta recusou o pedido.";
  }
}

/** Lê `estimated_time_to_regain_access` (minutos) do cabeçalho de uso por negócio. */
export function readRetryAfterMinutes(headers: Headers): number | null {
  const businessUsage = headers.get("x-business-use-case-usage");
  if (!businessUsage) return null;
  try {
    const usageByBusiness = JSON.parse(businessUsage) as Record<string, { estimated_time_to_regain_access?: number }[]>;
    const waits = Object.values(usageByBusiness)
      .flat()
      .map((usage) => Number(usage.estimated_time_to_regain_access ?? 0))
      .filter((minutes) => Number.isFinite(minutes) && minutes > 0);
    return waits.length > 0 ? Math.max(...waits) : null;
  } catch {
    return null;
  }
}

export function buildAppSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

/** URL da chamada. Nunca recebe o token: ele vai só no cabeçalho (RNF-3, CA-18). */
export function buildMetaGraphUrl(
  pathOrUrl: string,
  query?: Record<string, string | number | boolean | undefined>,
  appSecretProof?: string | null,
): string {
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(`${META_GRAPH_BASE_URL}/${pathOrUrl.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.delete("access_token");
  if (appSecretProof) url.searchParams.set("appsecret_proof", appSecretProof);
  return url.toString();
}

type GraphErrorPayload = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  error_user_title?: string;
  is_transient?: boolean;
  fbtrace_id?: string;
};

export async function metaGraphRequest<T>(
  pathOrUrl: string,
  options: {
    auth: MetaRequestAuth;
    method?: "GET" | "POST" | "DELETE";
    query?: Record<string, string | number | boolean | undefined>;
    body?: URLSearchParams;
  },
): Promise<T> {
  const method = options.method ?? "GET";
  const appSecretProof = options.auth.appSecret
    ? buildAppSecretProof(options.auth.accessToken, options.auth.appSecret)
    : null;
  const url = buildMetaGraphUrl(pathOrUrl, options.query, appSecretProof);

  // Escrita nunca é repetida: um POST que chegou e expirou criaria o objeto duas vezes.
  const maxAttempts = method === "GET" ? 2 : 1;
  let lastError: MetaGraphError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        body: options.body,
        headers: { Authorization: `Bearer ${options.auth.accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (networkError) {
      lastError = new MetaGraphError({
        kind: "transient",
        message: `[MetaGraph] falha de rede: ${networkError instanceof Error ? networkError.message : "desconhecida"}`,
      });
      continue;
    }

    const responseBody = (await response.json().catch(() => null)) as (Record<string, unknown> & { error?: GraphErrorPayload }) | null;
    const graphError = responseBody?.error;
    if (!graphError && response.ok && responseBody) return responseBody as unknown as T;

    const code = graphError?.code ?? null;
    const kind = classifyMetaError(code, Boolean(graphError?.is_transient));
    const retryAfterMinutes = kind === "rate_limited" ? readRetryAfterMinutes(response.headers) : null;
    lastError = new MetaGraphError({
      kind,
      message: `[MetaGraph] ${graphError?.type ?? `HTTP ${response.status}`}: ${graphError?.message ?? "resposta inválida"}`,
      code,
      subcode: graphError?.error_subcode ?? null,
      userMessage: graphError?.error_user_msg ?? null,
      fbtraceId: graphError?.fbtrace_id ?? null,
      retryAfterMinutes,
    });
    if (kind !== "transient") break;
  }

  throw lastError ?? new MetaGraphError({ kind: "unknown", message: "[MetaGraph] erro desconhecido" });
}

/** Segue `paging.next` até `maxPages`. `truncated` diz se ficou dado de fora. */
export async function metaGraphPaginate<T>(
  pathOrUrl: string,
  options: {
    auth: MetaRequestAuth;
    query?: Record<string, string | number | boolean | undefined>;
    maxPages?: number;
  },
): Promise<{ items: T[]; truncated: boolean }> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const items: T[] = [];
  let nextUrl: string | null = pathOrUrl;
  let query = options.query;

  for (let page = 0; page < maxPages && nextUrl; page++) {
    const pageBody: { data?: T[]; paging?: { next?: string } } = await metaGraphRequest(nextUrl, { auth: options.auth, query });
    items.push(...(pageBody.data ?? []));
    nextUrl = pageBody.paging?.next ?? null;
    // `paging.next` já traz os parâmetros da primeira chamada.
    query = undefined;
  }

  return { items, truncated: Boolean(nextUrl) };
}
