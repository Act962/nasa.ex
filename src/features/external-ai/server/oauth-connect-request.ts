import "server-only";
import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import prisma from "@/lib/prisma";
import { decodeOAuthRequest } from "../lib/oauth-request";

// O que "Conectar ao ÓRBITA" mostra (spec 0135, RF-6): nome da IA e domínio de volta, lidos da query assinada; null se ela não confere.

export interface OAuthConnectRequest {
  signedQuery: string;
  clientName: string | null;
  returnDomain: string | null;
}

function hostOf(uri: string | null): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).host || new URL(uri).protocol.replace(/:$/, "");
  } catch {
    return null;
  }
}

export async function readOAuthConnectRequest(wrapped: string | null | undefined): Promise<OAuthConnectRequest | null> {
  const signedQuery = decodeOAuthRequest(wrapped);
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!signedQuery || !secret) return null;
  if (!(await verifyOAuthQueryParams(signedQuery, secret).catch(() => false))) return null;

  const params = new URLSearchParams(signedQuery);
  const clientId = params.get("client_id");
  if (!clientId) return null;
  const client = await prisma.oauthClient.findUnique({ where: { clientId }, select: { name: true, disabled: true } });
  if (!client || client.disabled) return null;

  return { signedQuery, clientName: client.name, returnDomain: hostOf(params.get("redirect_uri")) };
}
