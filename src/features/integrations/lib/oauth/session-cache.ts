import { randomBytes } from "crypto";
import type { OAuthProvider } from "./state-store";
import type { FbAdAccount, FbIgAccount, FbPage, FbUser } from "./meta-config";
import type { GoogleAdsCustomer, GoogleUserInfo } from "./google-config";

export type MetaSessionPayload = {
  provider: "meta";
  orgId: string;
  userId: string;
  accessToken: string;
  expiresAt: number | null;
  scopes: string[];
  fbUser: FbUser;
  pages: FbPage[];
  adAccounts: FbAdAccount[];
  igAccounts: FbIgAccount[];
};

export type GoogleSessionPayload = {
  provider: "google";
  orgId: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number | null;
  scopes: string[];
  googleUser: GoogleUserInfo;
  adsCustomers: GoogleAdsCustomer[];
};

export type SessionPayload = MetaSessionPayload | GoogleSessionPayload;

type Entry = { payload: SessionPayload; expiresAt: number };

const TTL_MS = 5 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __nasaOAuthSessionCache: Map<string, Entry> | undefined;
}

const cache: Map<string, Entry> =
  globalThis.__nasaOAuthSessionCache ?? (globalThis.__nasaOAuthSessionCache = new Map());

function gc() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k);
  }
}

export function putSession(payload: SessionPayload): string {
  gc();
  const id = randomBytes(24).toString("hex");
  cache.set(id, { payload, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function getSession(id: string): SessionPayload | null {
  gc();
  const entry = cache.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(id);
    return null;
  }
  return entry.payload;
}

export function consumeSession(id: string): SessionPayload | null {
  const payload = getSession(id);
  if (payload) cache.delete(id);
  return payload;
}

export function getSessionByProvider(id: string, provider: OAuthProvider): SessionPayload | null {
  const s = getSession(id);
  if (!s || s.provider !== provider) return null;
  return s;
}
