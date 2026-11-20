import "server-only";
import { createLocalJWKSet, errors, jwtVerify, type JSONWebKeySet } from "jose";
import { auth } from "@/lib/auth";
import { AUTH_BASE_PATH, mcpResourceUrl, oauthIssuerUrl, resolveAuthOrigin } from "./oauth-config";

// Confere o token OAuth das IAs (spec 0135, RF-7, RF-8): assinatura, emissor, audiência e validade; a conexão é conferida à parte.

const JWKS_CACHE_MS = 5 * 60 * 1000;

// Só leitura e recarregável: duas réplicas com caches diferentes dão o mesmo resultado (RNF-1, CB-7).
let cachedKeys: { keys: ReturnType<typeof createLocalJWKSet>; loadedAt: number } | null = null;

async function fetchJwks(): Promise<JSONWebKeySet> {
  const response = await auth.handler(new Request(`${resolveAuthOrigin()}${AUTH_BASE_PATH}/jwks`));
  if (!response.ok) throw new Error(`Leitura do JWKS falhou com ${response.status}`);
  return (await response.json()) as JSONWebKeySet;
}

async function loadKeys(shouldRefresh: boolean) {
  const now = Date.now();
  if (shouldRefresh || !cachedKeys || now - cachedKeys.loadedAt > JWKS_CACHE_MS) {
    cachedKeys = { keys: createLocalJWKSet(await fetchJwks()), loadedAt: now };
  }
  return cachedKeys.keys;
}

export interface OAuthTokenHolder {
  userId: string;
  clientId: string;
}

async function verifyWith(token: string, shouldRefresh: boolean): Promise<OAuthTokenHolder | null> {
  const { payload } = await jwtVerify(token, await loadKeys(shouldRefresh), {
    issuer: oauthIssuerUrl(),
    audience: mcpResourceUrl(),
  });
  const clientId = payload.client_id ?? payload.azp;
  return typeof payload.sub === "string" && typeof clientId === "string" ? { userId: payload.sub, clientId } : null;
}

export async function verifyOAuthAccessToken(token: string): Promise<OAuthTokenHolder | null> {
  try {
    return await verifyWith(token, false);
  } catch (error) {
    // A chave girou depois do cache: lê o JWKS de novo uma vez (CB-6).
    if (!(error instanceof errors.JWKSNoMatchingKey)) return null;
    try {
      return await verifyWith(token, true);
    } catch {
      return null;
    }
  }
}
