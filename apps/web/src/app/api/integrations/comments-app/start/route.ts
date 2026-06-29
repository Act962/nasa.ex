import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  buildCommentsAuthorizeUrl,
  buildCommentsCallbackUrl,
  commentsPublicOrigin,
} from "@/features/comments/lib/oauth";
import {
  encodeState,
  setStateCookie,
} from "@/features/integrations/lib/oauth/state-store";

export async function GET(req: NextRequest) {
  const origin = commentsPublicOrigin();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const orgId = session.session?.activeOrganizationId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/home?error=no_org", origin));
  }

  const url = new URL(req.url);
  const returnUrl = url.searchParams.get("returnUrl") || "/apps";

  try {
    const state = encodeState({
      orgId,
      userId: session.user.id,
      provider: "comments-app",
      returnUrl,
    });
    await setStateCookie(state);

    const authorizeUrl = buildCommentsAuthorizeUrl({
      state,
      redirectUri: buildCommentsCallbackUrl(),
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Falha ao iniciar OAuth comments-app";
    const dest = new URL(returnUrl, origin);
    dest.searchParams.set("comments_error", msg);
    return NextResponse.redirect(dest);
  }
}
