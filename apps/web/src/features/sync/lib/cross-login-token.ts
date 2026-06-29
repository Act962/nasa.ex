import { createHmac } from "node:crypto";

/**
 * Token de "login cross-app" NASA → NERP.
 *
 * O admin do NASA gera um token assinado com a credencial de SISTEMA
 * (`SYNC_SHARED_SECRET`, mesma do sync bidirecional — ver `system-cred.ts`) que
 * carrega o `userId` alvo + expiração curta. O NERP verifica a assinatura e o
 * `exp` (ver `nerp-2/src/lib/cross-login.ts`) e cria uma sessão better-auth pra
 * aquele usuário — sem precisar de credenciais, já que a conta está replicada
 * com o mesmo `id`.
 *
 * Formato: `${base64url(JSON{userId,exp})}.${HMAC-SHA256(payloadB64)}` (hex).
 * Stateless dos dois lados: TTL curto, sem persistência/nonce.
 */

const DEFAULT_TTL_MS = 60_000; // 60s — janela curta de uso

function getSharedSecret(): string {
  const s = process.env.SYNC_SHARED_SECRET;
  if (!s) {
    throw new Error(
      "Missing env SYNC_SHARED_SECRET. Generate with 'openssl rand -hex 32'.",
    );
  }
  return s;
}

export function buildCrossLoginToken(
  userId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const payload = { userId, exp: Date.now() + ttlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSharedSecret())
    .update(payloadB64)
    .digest("hex");
  return `${payloadB64}.${signature}`;
}
