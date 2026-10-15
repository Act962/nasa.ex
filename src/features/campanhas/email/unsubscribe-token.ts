// Spec 0107 (RF-4): link de descadastro assinado. Carrega só empresa e email, nunca o id do lead.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET ausente: não dá para assinar o descadastro.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(`email-unsubscribe:${payload}`).digest("base64url");
}

export function createUnsubscribeToken(organizationId: string, email: string): string {
  const payload = Buffer.from(`${organizationId}\n${email.toLowerCase()}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readUnsubscribeToken(
  token: string,
): { organizationId: string; email: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  const [organizationId, email] = Buffer.from(payload, "base64url").toString("utf8").split("\n");
  return organizationId && email ? { organizationId, email } : null;
}

export function buildUnsubscribeUrl(organizationId: string, email: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${baseUrl}/email/descadastrar?t=${createUnsubscribeToken(organizationId, email)}`;
}
