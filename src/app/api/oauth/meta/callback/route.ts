import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMetaConnections,
  metaPublicOrigin,
  META_SCOPES,
} from "@/lib/oauth/meta-config";
import { consumeState } from "@/lib/oauth/state-store";
import { putSession } from "@/lib/oauth/session-cache";

function errorRedirect(origin: string, returnUrl: string, code: string) {
  const url = new URL(returnUrl, origin);
  url.searchParams.set("oauth_error", code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const origin = metaPublicOrigin();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const fbError = url.searchParams.get("error");
  const fbErrorReason = url.searchParams.get("error_reason");

  if (fbError) {
    return errorRedirect(origin, "/integrations/marketplace", fbErrorReason || fbError);
  }

  if (!code || !stateRaw) {
    return errorRedirect(origin, "/integrations/marketplace", "missing_code_or_state");
  }

  const state = await consumeState(stateRaw);
  if (!state || state.provider !== "meta") {
    return errorRedirect(origin, "/integrations/marketplace", "invalid_state");
  }

  try {
    const short = await exchangeCodeForToken(code);
    let accessToken = short.access_token;
    let expiresIn = short.expires_in;

    try {
      const longLived = await exchangeForLongLivedToken(short.access_token);
      accessToken = longLived.access_token;
      expiresIn = longLived.expires_in ?? expiresIn;
    } catch {
      // mantém short-lived se long-lived falhar
    }

    const connections = await fetchMetaConnections(accessToken);

    const sessionId = putSession({
      provider: "meta",
      orgId: state.orgId,
      userId: state.userId,
      accessToken,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
      scopes: [...META_SCOPES],
      fbUser: connections.user,
      pages: connections.pages,
      adAccounts: connections.adAccounts,
      igAccounts: connections.igAccounts,
    });

    const target = new URL(state.returnUrl, origin);
    target.searchParams.set("oauth_session", sessionId);
    target.searchParams.set("oauth_provider", "meta");
    target.searchParams.set("oauth_step", "select");
    return NextResponse.redirect(target);
  } catch (err) {
    console.error("Meta OAuth callback erro:", err);
    return errorRedirect(origin, state.returnUrl, "exchange_failed");
  }
}
