import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildMetaAuthUrl, metaPublicOrigin } from "@/lib/oauth/meta-config";
import { encodeState, setStateCookie } from "@/lib/oauth/state-store";

export async function GET(req: NextRequest) {
  const origin = metaPublicOrigin();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const orgId = session.session?.activeOrganizationId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/home?error=no_org", origin));
  }

  const url = new URL(req.url);
  const returnUrl = url.searchParams.get("returnUrl") || "/integrations/marketplace";

  try {
    const state = encodeState({
      orgId,
      userId: session.user.id,
      provider: "meta",
      returnUrl,
    });
    await setStateCookie(state);
    return NextResponse.redirect(buildMetaAuthUrl(state));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao iniciar OAuth Meta";
    const dest = new URL(returnUrl, origin);
    dest.searchParams.set("oauth_error", msg);
    return NextResponse.redirect(dest);
  }
}
