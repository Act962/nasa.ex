import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Credencial de SISTEMA para o sync bidirecional de auth NASA ↔ NERP.
 *
 * Diferente do consent S2S por-org (`NasaIntegrationKey`, amarrado a uma org e
 * inútil no sign-up onde ainda não há org), esta é uma chave master app↔app:
 * um único `SYNC_SHARED_SECRET` (HMAC) idêntico nos dois lados + `SYNC_API_KEY`
 * que identifica o caller. O esquema canônico de assinatura é o mesmo usado em
 * `src/http/nerp/sign.ts` e no verificador do NERP (`nasa-s2s-verify.ts`):
 *
 *   canonical = `${METHOD}\n${path}\n${body}\n${timestamp}`
 *   signature = HMAC-SHA256(canonical, SYNC_SHARED_SECRET)
 */

const DRIFT_MS = 5 * 60 * 1000;

export const SYNC_API_KEY_HEADER = "x-sync-api-key";
export const SYNC_TIMESTAMP_HEADER = "x-sync-timestamp";
export const SYNC_SIGNATURE_HEADER = "x-sync-signature";

function getSharedSecret(): string {
  const s = process.env.SYNC_SHARED_SECRET;
  if (!s) {
    throw new Error(
      "Missing env SYNC_SHARED_SECRET. Generate with 'openssl rand -hex 32'.",
    );
  }
  return s;
}

function getApiKey(): string {
  const k = process.env.SYNC_API_KEY;
  if (!k) {
    throw new Error("Missing env SYNC_API_KEY.");
  }
  return k;
}

export function buildCanonical(
  method: string,
  path: string,
  body: string,
  timestamp: string,
): string {
  return `${method.toUpperCase()}\n${path}\n${body}\n${timestamp}`;
}

function sign(
  method: string,
  path: string,
  body: string,
  timestamp: string,
): string {
  return createHmac("sha256", getSharedSecret())
    .update(buildCanonical(method, path, body, timestamp))
    .digest("hex");
}

/**
 * Headers assinados para uma requisição outbound (cliente NASA → NERP).
 * `path` deve ser o `pathname` (sem query), igual ao que o verificador remoto
 * usa pra reconstruir a string canônica.
 */
export function buildSyncHeaders(args: {
  method: string;
  path: string;
  body: string;
}): Record<string, string> {
  const timestamp = String(Date.now());
  const signature = sign(args.method, args.path, args.body, timestamp);
  return {
    "content-type": "application/json",
    [SYNC_API_KEY_HEADER]: getApiKey(),
    [SYNC_TIMESTAMP_HEADER]: timestamp,
    [SYNC_SIGNATURE_HEADER]: signature,
  };
}

function hexEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verifica a assinatura HMAC de uma requisição inbound (NERP → NASA).
 * Retorna `true` se válida. Best-effort: nunca lança — qualquer falha vira
 * `false` e o endpoint responde 401.
 */
export async function verifySyncRequest(request: Request): Promise<boolean> {
  try {
    const apiKey = request.headers.get(SYNC_API_KEY_HEADER);
    const timestamp = request.headers.get(SYNC_TIMESTAMP_HEADER);
    const signature = request.headers.get(SYNC_SIGNATURE_HEADER);
    if (!apiKey || !timestamp || !signature) return false;

    if (apiKey !== getApiKey()) return false;

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > DRIFT_MS) {
      return false;
    }

    const rawBody = await request.clone().text();
    const url = new URL(request.url);
    const expected = sign(request.method, url.pathname, rawBody, timestamp);
    return hexEqual(expected, signature);
  } catch {
    return false;
  }
}
