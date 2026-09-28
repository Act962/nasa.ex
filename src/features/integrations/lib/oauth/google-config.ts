const OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export type GoogleScope = (typeof GOOGLE_SCOPES)[number];

function clientId(): string {
  const value = process.env.GOOGLE_INTEGRATIONS_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  if (!value) throw new Error("Google client id ausente (defina GOOGLE_CLIENT_ID ou GOOGLE_INTEGRATIONS_CLIENT_ID)");
  return value;
}

function clientSecret(): string {
  const value = process.env.GOOGLE_INTEGRATIONS_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!value) throw new Error("Google client secret ausente (defina GOOGLE_CLIENT_SECRET ou GOOGLE_INTEGRATIONS_CLIENT_SECRET)");
  return value;
}

export function googleRedirectUri(): string {
  const explicitRedirectUri = process.env.GOOGLE_INTEGRATIONS_REDIRECT_URI;
  if (explicitRedirectUri) return explicitRedirectUri;
  const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error("Base URL ausente para redirect do Google (defina BETTER_AUTH_URL ou GOOGLE_INTEGRATIONS_REDIRECT_URI)");
  }
  return `${baseUrl.replace(/\/+$/, "")}/api/oauth/google/callback`;
}

export function googlePublicOrigin(): string {
  return new URL(googleRedirectUri()).origin;
}

export function buildGoogleAuthUrl(state: string, scopes: readonly string[] = GOOGLE_SCOPES): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: googleRedirectUri(),
    state,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${OAUTH_BASE}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

export async function exchangeCodeForGoogleToken(code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth token exchange falhou: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export type GoogleUserInfo = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo falhou: ${res.status}`);
  return (await res.json()) as GoogleUserInfo;
}

export type GoogleAdsCustomer = {
  id: string;
  resourceName: string;
};

export async function fetchGoogleAdsCustomers(accessToken: string): Promise<GoogleAdsCustomer[]> {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) {
    return [];
  }
  try {
    const res = await fetch("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": devToken,
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { resourceNames?: string[] };
    return (data.resourceNames ?? []).map((rn) => ({
      id: rn.replace("customers/", ""),
      resourceName: rn,
    }));
  } catch {
    return [];
  }
}

export async function revokeGoogleToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token });
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).catch(() => undefined);
}

export async function refreshGoogleToken(
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google refresh token falhou: ${res.status} ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}
