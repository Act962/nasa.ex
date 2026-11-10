import { CONNECT_PAGE_PATH } from "../server/oauth-config";

// A query assinada pelo better-auth tem chaves repetidas que o roteador reescreveria: vai inteira num parâmetro base64url (spec 0135, D-4).

/** Campos que o better-auth acrescenta ao assinar; sem eles, a query volta a ser o pedido original da IA. */
const SIGNATURE_PARAMS = new Set(["exp", "sig", "ba_iat", "ba_param"]);

export function encodeOAuthRequest(signedQuery: string): string {
  return Buffer.from(signedQuery, "utf-8").toString("base64url");
}

export function decodeOAuthRequest(wrapped: string | null | undefined): string | null {
  if (!wrapped || !/^[A-Za-z0-9_-]+$/.test(wrapped)) return null;
  try {
    return Buffer.from(wrapped, "base64url").toString("utf-8");
  } catch {
    return null;
  }
}

export const connectPageHref = (wrapped: string) => `${CONNECT_PAGE_PATH}?${new URLSearchParams({ request: wrapped })}`;

/**
 * Depois do login (que pode levar mais que a validade da assinatura, ex.: criar conta), o pedido
 * passa de novo pela autorização, que assina outra vez e segue para a tela de permitir.
 */
export const resumeAuthorizationHref = (wrapped: string) => `/api/external-ai/oauth/resume?${new URLSearchParams({ request: wrapped })}`;

export function toOriginalAuthorizeQuery(signedQuery: string): string {
  const params = new URLSearchParams(signedQuery);
  for (const name of SIGNATURE_PARAMS) params.delete(name);
  return params.toString();
}
