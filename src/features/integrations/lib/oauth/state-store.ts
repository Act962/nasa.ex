import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "nasa_oauth_state";
const TTL_MS = 10 * 60 * 1000;

export type OAuthProvider = "meta" | "google";

export type OAuthStatePayload = {
  orgId: string;
  userId: string;
  provider: OAuthProvider;
  returnUrl: string;
  nonce: string;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET ausente para assinar OAuth state");
  return secret;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 2 ? "==" : input.length % 4 === 3 ? "=" : "";
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", getSecret()).update(payload).digest());
}

export function encodeState(input: Omit<OAuthStatePayload, "nonce" | "exp">): string {
  const payload: OAuthStatePayload = {
    ...input,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function decodeState(token: string): OAuthStatePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const json = JSON.parse(b64urlDecode(body).toString("utf-8")) as OAuthStatePayload;
    if (!json.exp || json.exp < Date.now()) return null;
    return json;
  } catch {
    return null;
  }
}

export async function setStateCookie(token: string) {
  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

export async function readStateCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function clearStateCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function consumeState(stateFromQuery: string): Promise<OAuthStatePayload | null> {
  const cookieValue = await readStateCookie();
  if (!cookieValue || cookieValue !== stateFromQuery) return null;
  const payload = decodeState(stateFromQuery);
  await clearStateCookie();
  return payload;
}
