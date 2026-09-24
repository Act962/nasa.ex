const DEFAULT_AUTHORIZE_PATH = "/authorize/nasa-integration";
const DEFAULT_EXCHANGE_PATH = "/api/integrations/nasa/exchange";

export const COMMENTS_DEFAULT_SCOPES = [
  "user:read",
  "automations:read",
  "automations:write",
  "listener:write",
  "trigger:write",
  "keyword:write",
  "integration:read",
  "notifications:read",
  "subscription:read",
  "sorteio:read",
  "sorteio:write",
] as const;

export type CommentsExchangeResponse = {
  apiKey: string;
  secret: string;
  userId: string;
  scopes?: string[];
  expiresAt?: string | null;
};

export function commentsPublicOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  );
}

export function commentsBaseUrl(): string {
  const base = process.env.COMMENTS_APP_BASE_URL;
  if (!base) {
    throw new Error("COMMENTS_APP_BASE_URL ausente nas variáveis de ambiente");
  }
  return base.replace(/\/$/, "");
}

export function buildCommentsAuthorizeUrl(input: {
  state: string;
  redirectUri: string;
  scopes?: readonly string[];
}): string {
  const path =
    process.env.COMMENTS_OAUTH_AUTHORIZE_PATH || DEFAULT_AUTHORIZE_PATH;
  const url = new URL(path, commentsBaseUrl());
  url.searchParams.set("state", input.state);
  url.searchParams.set("redirectUri", input.redirectUri);
  url.searchParams.set(
    "scopes",
    (input.scopes ?? COMMENTS_DEFAULT_SCOPES).join(","),
  );
  url.searchParams.set("clientId", process.env.NASA_COMMENTS_CLIENT_ID || "");
  return url.toString();
}

export async function exchangeCommentsCode(
  code: string,
): Promise<CommentsExchangeResponse> {
  const path =
    process.env.COMMENTS_OAUTH_EXCHANGE_PATH || DEFAULT_EXCHANGE_PATH;
  const clientId = process.env.NASA_COMMENTS_CLIENT_ID;
  const clientSecret = process.env.NASA_COMMENTS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "NASA_COMMENTS_CLIENT_ID/NASA_COMMENTS_CLIENT_SECRET ausentes",
    );
  }

  const response = await fetch(`${commentsBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code, clientId, clientSecret }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `comments-app exchange falhou: ${response.status} ${response.statusText} — ${text.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as Partial<CommentsExchangeResponse>;
  if (!json.apiKey || !json.secret || !json.userId) {
    throw new Error("comments-app exchange retornou payload incompleto");
  }
  return {
    apiKey: json.apiKey,
    secret: json.secret,
    userId: json.userId,
    scopes: json.scopes,
    expiresAt: json.expiresAt ?? null,
  };
}

export function buildCommentsCallbackUrl(): string {
  return `${commentsPublicOrigin()}/api/integrations/comments-app/callback`;
}
