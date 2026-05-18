const DEFAULT_AUTHORIZE_PATH = "/authorize/nasa-integration";
const DEFAULT_EXCHANGE_PATH = "/api/integrations/nasa/exchange";

export const NERP_DEFAULT_SCOPES = [
  "products:rw",
  "categories:rw",
  "catalog-settings:rw",
  "stocks:rw",
  "org:rw",
  "customer:rw",
  "sales:rw",
  "checkout:rw",
  "dashboard:r",
] as const;

export type NerpExchangeResponse = {
  apiKey: string;
  secret: string;
  nerpOrgId: string;
  scopes?: string[];
  expiresAt?: string | null;
};

export function nerpPublicOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  );
}

export function nerpBaseUrl(): string {
  const base = process.env.NERP_BASE_URL;
  if (!base) throw new Error("NERP_BASE_URL ausente nas variáveis de ambiente");
  return base.replace(/\/$/, "");
}

export function buildNerpAuthorizeUrl(input: {
  state: string;
  redirectUri: string;
  scopes?: readonly string[];
}): string {
  const path = process.env.NERP_OAUTH_AUTHORIZE_PATH || DEFAULT_AUTHORIZE_PATH;
  const url = new URL(path, nerpBaseUrl());
  url.searchParams.set("state", input.state);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set(
    "scopes",
    (input.scopes ?? NERP_DEFAULT_SCOPES).join(","),
  );
  url.searchParams.set("client_id", process.env.NERP_CLIENT_ID || "");
  return url.toString();
}

export async function exchangeNerpCode(code: string): Promise<NerpExchangeResponse> {
  const path = process.env.NERP_OAUTH_EXCHANGE_PATH || DEFAULT_EXCHANGE_PATH;
  const clientId = process.env.NERP_CLIENT_ID;
  const clientSecret = process.env.NERP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NERP_CLIENT_ID/NERP_CLIENT_SECRET ausentes");
  }

  const response = await fetch(`${nerpBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code, clientId, clientSecret }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `nerp exchange falhou: ${response.status} ${response.statusText} — ${text.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as Partial<NerpExchangeResponse>;
  if (!json.apiKey || !json.secret || !json.nerpOrgId) {
    throw new Error("nerp exchange retornou payload incompleto");
  }
  return {
    apiKey: json.apiKey,
    secret: json.secret,
    nerpOrgId: json.nerpOrgId,
    scopes: json.scopes,
    expiresAt: json.expiresAt ?? null,
  };
}

export function buildNerpCallbackUrl(): string {
  return `${nerpPublicOrigin()}/api/integrations/nerp/callback`;
}
