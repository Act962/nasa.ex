import "server-only";

import prisma from "@/lib/prisma";
import { refreshGoogleToken } from "./google-config";

// Token Google de uma org: primeiro o login Google do usuário (better-auth),
// quando há `userId` e o escopo pedido; depois a `PlatformIntegration GMAIL`
// da org — a conta de quem conectou em /integrations (spec 0018, D-1).

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_MARGIN_MS = 60_000;

export interface GoogleIntegrationConfig {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  scopes?: string | string[] | null;
  userEmail?: string | null;
}

interface AuthAccountTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export type ResolveGoogleAccessTokenResult =
  | {
      ok: true;
      accessToken: string;
      source: "auth-login" | "integration";
      accountEmail: string | null;
    }
  | {
      ok: false;
      reason: "no_integration" | "missing_scope" | "missing_token" | "refresh_failed";
      message: string;
    };

export function hasGoogleScope(
  scopes: string | string[] | null | undefined,
  requiredScope: string,
): boolean {
  if (!scopes) return false;
  const scopeList = Array.isArray(scopes) ? scopes : scopes.split(/\s+/);
  return scopeList.includes(requiredScope);
}

async function refreshAuthAccountToken(refreshToken: string): Promise<AuthAccountTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/SECRET ausentes");
  }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Auth Google refresh falhou: ${response.status} ${responseText}`);
  }
  return (await response.json()) as AuthAccountTokenResponse;
}

async function resolveFromAuthLogin(
  userId: string,
  requiredScope: string,
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      accessTokenExpiresAt: true,
      scope: true,
    },
  });
  if (!account?.accessToken || !hasGoogleScope(account.scope, requiredScope)) return null;

  const expiresAtMs = account.accessTokenExpiresAt ? account.accessTokenExpiresAt.getTime() : 0;
  const nowMs = Date.now();
  if (!expiresAtMs || expiresAtMs - EXPIRY_MARGIN_MS >= nowMs || !account.refreshToken) {
    return account.accessToken;
  }

  try {
    const refreshed = await refreshAuthAccountToken(account.refreshToken);
    await prisma.account.update({
      where: { id: account.id },
      data: {
        accessToken: refreshed.access_token,
        accessTokenExpiresAt: new Date(nowMs + refreshed.expires_in * 1000),
        ...(refreshed.refresh_token ? { refreshToken: refreshed.refresh_token } : {}),
        ...(refreshed.scope ? { scope: refreshed.scope } : {}),
      },
    });
    return refreshed.access_token;
  } catch {
    return null;
  }
}

export async function resolveGoogleAccessToken(params: {
  organizationId: string;
  userId?: string;
  requiredScope: string;
}): Promise<ResolveGoogleAccessTokenResult> {
  if (params.userId) {
    const loginToken = await resolveFromAuthLogin(params.userId, params.requiredScope);
    if (loginToken) {
      return { ok: true, accessToken: loginToken, source: "auth-login", accountEmail: null };
    }
  }

  const integration = await prisma.platformIntegration.findFirst({
    where: { organizationId: params.organizationId, platform: "GMAIL", isActive: true },
  });
  if (!integration) {
    return {
      ok: false,
      reason: "no_integration",
      message: "Conecte a integração Google em /integrations.",
    };
  }

  const config = (integration.config ?? {}) as unknown as GoogleIntegrationConfig;
  const accountEmail = config.userEmail ?? null;

  if (!hasGoogleScope(config.scopes, params.requiredScope)) {
    return {
      ok: false,
      reason: "missing_scope",
      message: "A integração Google atual não tem a permissão necessária. Reconecte em /integrations pra autorizar o novo escopo.",
    };
  }

  const accessToken = config.accessToken ?? "";
  if (!accessToken) {
    return { ok: false, reason: "missing_token", message: "Token Google ausente. Reconecte a integração." };
  }

  const refreshToken = config.refreshToken ?? null;
  const expiresAtMs = config.expiresAt ?? 0;
  const nowMs = Date.now();
  if (!expiresAtMs || expiresAtMs - EXPIRY_MARGIN_MS >= nowMs || !refreshToken) {
    return { ok: true, accessToken, source: "integration", accountEmail };
  }

  try {
    const refreshed = await refreshGoogleToken(refreshToken);
    const refreshedConfig: GoogleIntegrationConfig = {
      ...config,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      expiresAt: nowMs + refreshed.expires_in * 1000,
      scopes: refreshed.scope,
    };
    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: { config: refreshedConfig as unknown as object },
    });
    return { ok: true, accessToken: refreshed.access_token, source: "integration", accountEmail };
  } catch (error) {
    return {
      ok: false,
      reason: "refresh_failed",
      message: `Falha ao renovar token Google: ${(error as Error).message}. Reconecte a integração.`,
    };
  }
}
