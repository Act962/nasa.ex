import type { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { generateVisitorToken, hashVisitorToken } from "@/features/astro-chat/lib/keys";
import { normalizeOrigin } from "@/features/astro-chat/lib/origins";
import { isNewVisitorAllowed } from "@/features/astro-chat/server/rate-limit";
import {
  handlePreflight,
  isGateFailure,
  jsonResponse,
  readIpHash,
  readRequestOrigin,
  resolvePublicSite,
  resolveVisitor,
} from "@/features/astro-chat/server/public-api";

/**
 * Sessão do visitante do ASTRO CHAT (spec 0031, TR-3). Reaproveita o token
 * guardado no navegador; sem token válido, emite um novo.
 */

type RouteParams = { params: Promise<{ key: string }> };

const sessionInputSchema = z.object({
  pageUrl: z.string().max(500).optional(),
});

export async function OPTIONS(request: NextRequest, { params }: RouteParams) {
  const { key } = await params;
  return handlePreflight(request, key);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { key } = await params;
  const origin = readRequestOrigin(request);
  const gate = await resolvePublicSite(key, origin);
  if (isGateFailure(gate)) {
    return jsonResponse({ error: gate.error }, { status: gate.status, origin: null });
  }
  const { site } = gate;

  const payload = sessionInputSchema.safeParse(await request.json().catch(() => ({})));
  const pageUrl = payload.success ? payload.data.pageUrl ?? null : null;

  const existingVisitor = await resolveVisitor(request, site.id);
  if (existingVisitor) {
    await prisma.astroChatVisitor.update({
      where: { id: existingVisitor.id },
      data: { lastSeenAt: new Date(), ...(pageUrl ? { pageUrl } : {}) },
    });
    return jsonResponse({ token: null, hasConversation: !!existingVisitor.leadId }, { origin });
  }

  const ipHash = readIpHash(request);
  if (!(await isNewVisitorAllowed(ipHash))) {
    return jsonResponse({ error: "rate_limited" }, { status: 429, origin });
  }

  const token = generateVisitorToken();
  await prisma.astroChatVisitor.create({
    data: {
      siteId: site.id,
      tokenHash: hashVisitorToken(token),
      ipHash,
      origin: origin ? normalizeOrigin(origin) : null,
      pageUrl,
    },
  });
  return jsonResponse({ token, hasConversation: false }, { origin });
}
