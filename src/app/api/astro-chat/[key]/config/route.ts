import type { NextRequest } from "next/server";
import {
  handlePreflight,
  isGateFailure,
  jsonResponse,
  readRequestOrigin,
  resolvePublicSite,
} from "@/features/astro-chat/server/public-api";

/** Aparência pública do widget ASTRO CHAT (spec 0031). Sem dado interno. */

type RouteParams = { params: Promise<{ key: string }> };

export async function OPTIONS(request: NextRequest, { params }: RouteParams) {
  const { key } = await params;
  return handlePreflight(request, key);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { key } = await params;
  const origin = readRequestOrigin(request);
  const gate = await resolvePublicSite(key, origin);
  if (isGateFailure(gate)) {
    return jsonResponse({ error: gate.error }, { status: gate.status, origin: null });
  }
  const { site } = gate;
  return jsonResponse(
    {
      companyName: site.organization.name,
      companyLogo: site.organization.logo,
      assistantName: site.assistantName,
      greeting: site.greeting,
      accentColor: site.accentColor,
      avatarUrl: site.avatarUrl,
      theme: site.widgetTheme === "dark" ? "dark" : "light",
      position: site.position,
      privacyUrl: site.privacyUrl,
    },
    { origin },
  );
}
