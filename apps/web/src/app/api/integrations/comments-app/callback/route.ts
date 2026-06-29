import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import {
  exchangeCommentsCode,
  commentsPublicOrigin,
  COMMENTS_DEFAULT_SCOPES,
} from "@/features/comments/lib/oauth";
import { consumeState } from "@/features/integrations/lib/oauth/state-store";

function errorRedirect(origin: string, returnUrl: string, code: string) {
  const url = new URL(returnUrl, origin);
  url.searchParams.set("comments_error", code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const origin = commentsPublicOrigin();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const remoteError = url.searchParams.get("error");

  if (remoteError) {
    return errorRedirect(origin, "/apps", remoteError);
  }
  if (!code || !stateRaw) {
    return errorRedirect(origin, "/apps", "missing_code_or_state");
  }

  const state = await consumeState(stateRaw);
  if (!state || state.provider !== "comments-app") {
    return errorRedirect(origin, "/apps", "invalid_state");
  }

  try {
    const creds = await exchangeCommentsCode(code);

    await prisma.platformIntegration.upsert({
      where: {
        organizationId_platform: {
          organizationId: state.orgId,
          platform: IntegrationPlatform.COMMENTS_APP,
        },
      },
      create: {
        organizationId: state.orgId,
        platform: IntegrationPlatform.COMMENTS_APP,
        isActive: true,
        config: {
          apiKey: creds.apiKey,
          secret: creds.secret,
          userId: creds.userId,
          scopes: creds.scopes ?? [...COMMENTS_DEFAULT_SCOPES],
          connectedAt: new Date().toISOString(),
          consentByUserId: state.userId,
        },
        lastSyncAt: new Date(),
      },
      update: {
        isActive: true,
        config: {
          apiKey: creds.apiKey,
          secret: creds.secret,
          userId: creds.userId,
          scopes: creds.scopes ?? [...COMMENTS_DEFAULT_SCOPES],
          connectedAt: new Date().toISOString(),
          consentByUserId: state.userId,
        },
        lastSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    const target = new URL(state.returnUrl, origin);
    target.searchParams.set("comments_connected", "1");
    return NextResponse.redirect(target);
  } catch (err) {
    console.error("[comments-app/callback] exchange falhou:", err);
    return errorRedirect(
      origin,
      state.returnUrl || "/apps",
      "exchange_failed",
    );
  }
}
