import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildGoogleAuthUrl } from "@/lib/oauth/google-config";
import { encodeState, setStateCookie } from "@/lib/oauth/state-store";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const orgId = session.session?.activeOrganizationId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/home?error=no_org", req.url));
  }

  const url = new URL(req.url);
  const returnUrl = url.searchParams.get("returnUrl") || "/integrations/marketplace";

  try {
    const state = encodeState({
      orgId,
      userId: session.user.id,
      provider: "google",
      returnUrl,
    });
    await setStateCookie(state);
    return NextResponse.redirect(buildGoogleAuthUrl(state));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao iniciar OAuth Google";
    const dest = new URL(returnUrl, req.url);
    dest.searchParams.set("oauth_error", msg);
    return NextResponse.redirect(dest);
  }
}
