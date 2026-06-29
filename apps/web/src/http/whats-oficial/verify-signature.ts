import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validação do header `x-hub-signature-256` que a Meta envia em todo POST de
 * webhook da WhatsApp Cloud API. Espelha o padrão de
 * `src/features/sync/lib/system-cred.ts` (HMAC-SHA256 + `timingSafeEqual`).
 *
 * Regras críticas:
 *   1. O HMAC é calculado sobre o RAW body — o handler deve ler
 *      `request.text()` antes de qualquer parse. Reparsear/re-stringificar
 *      quebra a assinatura.
 *   2. Fail-closed: qualquer erro inesperado vira `false`. Nunca lançar.
 *   3. Comparação em tempo constante (timing-safe) para impedir oráculos.
 */

const META_SIGNATURE_PREFIX = "sha256=";

/**
 * Confere o header `x-hub-signature-256` contra o raw body usando o App Secret.
 *
 * @param rawBody Body cru do POST, do jeito que veio pela rede.
 * @param signatureHeader Valor do header `x-hub-signature-256`
 *   (ex.: `sha256=fdb3fe47...`). `null`/`undefined` retornam `false`.
 * @param appSecret O App Secret da Meta App (Settings → Basic → App Secret).
 */
export function isMetaSignatureValid(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string,
): boolean {
  try {
    if (!signatureHeader || !appSecret) return false;
    if (!signatureHeader.startsWith(META_SIGNATURE_PREFIX)) return false;

    const receivedHex = signatureHeader.slice(META_SIGNATURE_PREFIX.length);
    if (!receivedHex) return false;

    const expectedHex = createHmac("sha256", appSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    return hexEqual(expectedHex, receivedHex);
  } catch {
    return false;
  }
}

/**
 * Resposta ao GET de verificação do webhook (subscription handshake).
 *
 * A Meta chama `GET <webhook>?hub.mode=subscribe&hub.verify_token=<t>&hub.challenge=<c>`
 * e espera o `challenge` em texto puro (200) se o `verify_token` confere.
 *
 * @returns O challenge a devolver, ou `null` se a verificação falhou (o
 *   handler deve responder 403).
 */
export function verifyWebhookChallenge(
  params: {
    mode: string | null | undefined;
    verifyToken: string | null | undefined;
    challenge: string | null | undefined;
  },
  expectedVerifyToken: string,
): string | null {
  if (!expectedVerifyToken) return null;
  if (params.mode !== "subscribe") return null;
  if (!params.verifyToken || !params.challenge) return null;
  if (params.verifyToken !== expectedVerifyToken) return null;
  return params.challenge;
}

function hexEqual(expectedHex: string, receivedHex: string): boolean {
  try {
    const expectedBuffer = Buffer.from(expectedHex, "hex");
    const receivedBuffer = Buffer.from(receivedHex, "hex");
    if (expectedBuffer.length === 0) return false;
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}
