import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForGoogleToken,
  fetchGoogleAdsCustomers,
  fetchGoogleUserInfo,
} from "@/lib/oauth/google-config";
import { consumeState } from "@/lib/oauth/state-store";
import { putSession } from "@/lib/oauth/session-cache";

function errorRedirect(req: NextRequest, returnUrl: string, code: string) {
  const url = new URL(returnUrl, req.url);
  url.searchParams.set("oauth_error", code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const gError = url.searchParams.get("error");

  if (gError) {
    return errorRedirect(req, "/integrations/marketplace", gError);
  }

  if (!code || !stateRaw) {
    return errorRedirect(req, "/integrations/marketplace", "missing_code_or_state");
  }

  const state = await consumeState(stateRaw);
  if (!state || state.provider !== "google") {
    return errorRedirect(req, "/integrations/marketplace", "invalid_state");
  }

  try {
    const tokens = await exchangeCodeForGoogleToken(code);
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);
    const adsCustomers = await fetchGoogleAdsCustomers(tokens.access_token);

    const sessionId = putSession({
      provider: "google",
      orgId: state.orgId,
      userId: state.userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      scopes: tokens.scope ? tokens.scope.split(" ") : [],
      googleUser: userInfo,
      adsCustomers,
    });

    const target = new URL(state.returnUrl, req.url);
    target.searchParams.set("oauth_session", sessionId);
    target.searchParams.set("oauth_provider", "google");
    target.searchParams.set("oauth_step", "select");
    return NextResponse.redirect(target);
  } catch (err) {
    console.error("Google OAuth callback erro:", err);
    return errorRedirect(req, state.returnUrl, "exchange_failed");
  }
}
