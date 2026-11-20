import { encodeOAuthRequest, resumeAuthorizationHref } from "@/features/external-ai/lib/oauth-request";

/** `loginPage` do OAuth das IAs (spec 0135, RF-5): entra e retoma a autorização com o pedido intacto. */
export function GET(request: Request) {
  const signedQuery = new URL(request.url).search.replace(/^\?/, "");
  const callbackUrl = resumeAuthorizationHref(encodeOAuthRequest(signedQuery));
  return new Response(null, { status: 302, headers: { location: `/sign-in?${new URLSearchParams({ callbackUrl })}` } });
}
