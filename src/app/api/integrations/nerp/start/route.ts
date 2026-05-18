import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  buildNerpAuthorizeUrl,
  buildNerpCallbackUrl,
  nerpPublicOrigin,
} from "@/features/nerp/lib/oauth";
import {
  encodeState,
  setStateCookie,
} from "@/features/integrations/lib/oauth/state-store";

export async function GET(req: NextRequest) {
  const origin = nerpPublicOrigin();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", origin));
  }

  const orgId = session.session?.activeOrganizationId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/home?error=no_org", origin));
  }

  const url = new URL(req.url);
  // Volta pra `/apps` por default — é onde o card do NERP vive. Callers que
  // disparam o fluxo de dentro de outra página podem sobrescrever via
  // `?returnUrl=`.
  const returnUrl = url.searchParams.get("returnUrl") || "/apps";

  try {
    const state = encodeState({
      orgId,
      userId: session.user.id,
      provider: "nerp",
      returnUrl,
    });
    await setStateCookie(state);

    const authorizeUrl = buildNerpAuthorizeUrl({
      state,
      redirectUri: buildNerpCallbackUrl(),
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao iniciar OAuth nerp";
    const dest = new URL(returnUrl, origin);
    dest.searchParams.set("nerp_error", msg);
    return NextResponse.redirect(dest);
  }
}
