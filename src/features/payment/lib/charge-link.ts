// Spec 0115 (RF-4): link público da cobrança, assinado. Carrega só empresa e lançamento,
// sem coluna nova: o token é recalculado a cada envio e conferido na página.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolvePublicOrigin } from "@/lib/public-origin";

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET ausente: não dá para assinar o link da cobrança.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(`payment-charge:${payload}`).digest("base64url");
}

export function createChargeToken(organizationId: string, entryId: string): string {
  const payload = Buffer.from(`${organizationId}\n${entryId}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readChargeToken(token: string): { organizationId: string; entryId: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  const [organizationId, entryId] = Buffer.from(payload, "base64url").toString("utf8").split("\n");
  return organizationId && entryId ? { organizationId, entryId } : null;
}

// Sai do servidor (Inngest, procedure) e vai para o cliente: precisa do endereço público,
// com o mesmo fallback de env dos outros links externos do app.
export function buildChargeUrl(organizationId: string, entryId: string): string {
  return `${resolvePublicOrigin()}/cobranca/${createChargeToken(organizationId, entryId)}`;
}
