import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Upload local do MCP em dev, quando o R2 não funciona (spec 0066, RF-5). Nunca liga em produção.
 * A URL leva uma assinatura HMAC com validade, no lugar da URL pré-assinada do R2.
 */

const UPLOAD_TTL_MS = 60 * 60 * 1000;
export const LOCAL_UPLOAD_PREFIX = "uploads/external-ai/";

export function isLocalUploadEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.EXTERNAL_AI_LOCAL_UPLOADS === "true";
}

function signLocalUpload(key: string, expiresAt: number) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET ausente.");
  return createHmac("sha256", secret).update(`${key}:${expiresAt}`).digest("hex");
}

export function createLocalUploadUrl(appOrigin: string, key: string) {
  const expiresAt = Date.now() + UPLOAD_TTL_MS;
  const query = new URLSearchParams({ key, expires: String(expiresAt), signature: signLocalUpload(key, expiresAt) });
  return { uploadUrl: `${appOrigin}/api/mcp/upload?${query}`, publicUrl: `${appOrigin}/${key}` };
}

export function isLocalUploadSignatureValid(key: string, expires: string, signature: string) {
  const expiresAt = Number(expires);
  if (!key.startsWith(LOCAL_UPLOAD_PREFIX) || key.includes("..") || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = Buffer.from(signLocalUpload(key, expiresAt));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
