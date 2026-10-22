import type { NextRequest } from "next/server";
import { buildWidgetScript } from "@/features/astro-chat/lib/widget-script";
import { resolvePublicOrigin } from "@/lib/public-origin";

/** Loader público do widget ASTRO CHAT (spec 0031, RF-3). */

export function GET(request: NextRequest) {
  const appOrigin = resolvePublicOrigin(request.headers);
  return new Response(buildWidgetScript(appOrigin), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
