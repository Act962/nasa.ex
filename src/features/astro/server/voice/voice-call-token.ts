import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Comprovante assinado de uma chamada de voz (spec 0054, D-4): o batimento só cobra chamada aberta por nós. */

export const VOICE_CALL_MAX_MS = 15 * 60 * 1000;
const VOICE_CALL_GRACE_MS = 2 * 60 * 1000;

export interface VoiceCallClaims {
  voiceCallId: string;
  userId: string;
  organizationId: string;
  isOwnKey: boolean;
  startedAt: number;
  /** Modelo de voz desta chamada, para o custo de cada resposta. */
  modelId?: string;
}

function resolveSigningSecret(): string {
  const signingSecret = process.env.BETTER_AUTH_SECRET;
  if (!signingSecret) throw new Error("BETTER_AUTH_SECRET ausente: não dá para assinar a chamada de voz.");
  return signingSecret;
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", resolveSigningSecret()).update(encodedPayload).digest("base64url");
}

export function signVoiceCallToken(claims: VoiceCallClaims): string {
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyVoiceCallToken(token: string): VoiceCallClaims | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = signPayload(encodedPayload);
  const isSignatureValid =
    expectedSignature.length === signature.length &&
    timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  if (!isSignatureValid) return null;
  try {
    const claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as VoiceCallClaims;
    const isExpired = Date.now() - claims.startedAt > VOICE_CALL_MAX_MS + VOICE_CALL_GRACE_MS;
    return isExpired ? null : claims;
  } catch {
    return null;
  }
}
