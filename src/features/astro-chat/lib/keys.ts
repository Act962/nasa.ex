import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Chaves e hashes do ASTRO CHAT (spec 0031, TR-2/TR-3/TR-9). */

export const PUBLIC_KEY_PREFIX = "ac_pk_";

export function generatePublicKey(): string {
  return `${PUBLIC_KEY_PREFIX}${randomBytes(12).toString("base64url")}`;
}

export function generateVisitorToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashVisitorToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** IP nunca é gravado cru (TR-9): hash salgado com o segredo da aplicação. */
export function hashIp(ip: string): string {
  const salt = process.env.BETTER_AUTH_SECRET ?? "astro-chat";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function isPublicKeyShape(value: string): boolean {
  return /^ac_pk_[A-Za-z0-9_-]{8,40}$/.test(value);
}
