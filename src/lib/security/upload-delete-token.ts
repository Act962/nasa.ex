// Token que autoriza apagar um arquivo recém-enviado. Quem faz o upload recebe
// o token junto com a `key`; com ele, um visitante sem sessão (formulário
// público) consegue remover o próprio arquivo, e só ele.

import { createHmac, timingSafeEqual } from "node:crypto";

export const UPLOAD_DELETE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function signKey(objectKey: string, expiresAtMs: number, secret: string): string {
  return createHmac("sha256", secret).update(`${expiresAtMs}:${objectKey}`, "utf8").digest("hex");
}

export function createUploadDeleteToken(
  objectKey: string,
  secret: string | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!secret || !objectKey) return null;
  const expiresAtMs = nowMs + UPLOAD_DELETE_TOKEN_TTL_MS;
  return `${expiresAtMs}.${signKey(objectKey, expiresAtMs, secret)}`;
}

export function isUploadDeleteTokenValid(
  objectKey: string,
  token: string | null | undefined,
  secret: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!secret || !objectKey || !token) return false;

  const [expiresAtText, receivedSignature, ...extraParts] = token.split(".");
  const expiresAtMs = Number(expiresAtText);
  if (extraParts.length > 0 || !receivedSignature || !Number.isSafeInteger(expiresAtMs)) return false;
  if (expiresAtMs <= nowMs) return false;

  const expectedBuffer = Buffer.from(signKey(objectKey, expiresAtMs, secret), "hex");
  const receivedBuffer = Buffer.from(receivedSignature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

/** Lido na chamada, não no import: o build roda sem segredos (CLAUDE.md, regra 24a). */
export function getUploadTokenSecret(): string | undefined {
  return process.env.BETTER_AUTH_SECRET || undefined;
}
