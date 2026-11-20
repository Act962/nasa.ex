import { connectPageHref, encodeOAuthRequest } from "@/features/external-ai/lib/oauth-request";

/** `consentPage` do OAuth das IAs (spec 0135, RF-6): leva o pedido assinado inteiro para /conectar-ia. */
export function GET(request: Request) {
  const signedQuery = new URL(request.url).search.replace(/^\?/, "");
  return new Response(null, { status: 302, headers: { location: connectPageHref(encodeOAuthRequest(signedQuery)) } });
}
