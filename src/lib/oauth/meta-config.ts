const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

export const META_SCOPES = [
  "ads_management",
  "ads_read",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_manage_messages",
  "business_management",
] as const;

export type MetaScope = (typeof META_SCOPES)[number];

function appId(): string {
  const v = process.env.META_APP_ID;
  if (!v) throw new Error("META_APP_ID ausente");
  return v;
}

function appSecret(): string {
  const v = process.env.META_APP_SECRET;
  if (!v) throw new Error("META_APP_SECRET ausente");
  return v;
}

export function metaRedirectUri(): string {
  const v = process.env.META_OAUTH_REDIRECT_URI;
  if (!v) throw new Error("META_OAUTH_REDIRECT_URI ausente");
  return v;
}

export function buildMetaAuthUrl(state: string, scopes: readonly string[] = META_SCOPES): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: metaRedirectUri(),
    state,
    response_type: "code",
    scope: scopes.join(","),
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

export type MetaTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

export async function exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    redirect_uri: metaRedirectUri(),
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`, {
    method: "GET",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta OAuth token exchange falhou: ${res.status} ${text}`);
  }
  return (await res.json()) as MetaTokenResponse;
}

export async function exchangeForLongLivedToken(shortToken: string): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Long-lived token falhou: ${res.status} ${text}`);
  }
  return (await res.json()) as MetaTokenResponse;
}

export type FbUser = { id: string; name: string };
export type FbPage = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  instagram_business_account?: { id: string };
};
export type FbAdAccount = {
  id: string;
  account_id: string;
  name: string;
  currency?: string;
  account_status?: number;
};
export type FbIgAccount = {
  id: string;
  username?: string;
  name?: string;
  page_id: string;
};

async function graph<T>(path: string, accessToken: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${GRAPH_BASE}${path}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API ${path} falhou: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export async function fetchMetaConnections(accessToken: string): Promise<{
  user: FbUser;
  pages: FbPage[];
  adAccounts: FbAdAccount[];
  igAccounts: FbIgAccount[];
}> {
  const user = await graph<FbUser>("/me?fields=id,name", accessToken);

  const pagesRes = await graph<{ data: FbPage[] }>(
    "/me/accounts?fields=id,name,access_token,category,instagram_business_account&limit=100",
    accessToken,
  );
  const pages = pagesRes.data ?? [];

  const adRes = await graph<{ data: FbAdAccount[] }>(
    "/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=100",
    accessToken,
  );
  const adAccounts = adRes.data ?? [];

  const igAccounts: FbIgAccount[] = [];
  for (const p of pages) {
    if (!p.instagram_business_account?.id) continue;
    try {
      const ig = await graph<{ id: string; username?: string; name?: string }>(
        `/${p.instagram_business_account.id}?fields=id,username,name`,
        accessToken,
      );
      igAccounts.push({ id: ig.id, username: ig.username, name: ig.name, page_id: p.id });
    } catch {
      // ignora ig inacessível
    }
  }

  return { user, pages, adAccounts, igAccounts };
}

export async function revokeMetaToken(accessToken: string, fbUserId: string): Promise<void> {
  const url = `${GRAPH_BASE}/${fbUserId}/permissions?access_token=${encodeURIComponent(accessToken)}`;
  await fetch(url, { method: "DELETE" }).catch(() => undefined);
}
