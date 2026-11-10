import { decodeOAuthRequest, toOriginalAuthorizeQuery } from "@/features/external-ai/lib/oauth-request";
import { AUTH_BASE_PATH } from "@/features/external-ai/server/oauth-config";

/** Volta do login (spec 0135, RF-5): refaz a autorização para o pedido ganhar assinatura nova. A própria autorização valida tudo. */
export function GET(request: Request) {
  const signedQuery = decodeOAuthRequest(new URL(request.url).searchParams.get("request"));
  if (!signedQuery) return new Response(null, { status: 302, headers: { location: "/conectar-ia" } });
  return new Response(null, { status: 302, headers: { location: `${AUTH_BASE_PATH}/oauth2/authorize?${toOriginalAuthorizeQuery(signedQuery)}` } });
}
