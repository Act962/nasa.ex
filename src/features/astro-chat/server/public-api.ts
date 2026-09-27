import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashIp, hashVisitorToken, isPublicKeyShape } from "../lib/keys";
import { isOriginAllowed } from "../lib/origins";

/**
 * Portão das rotas públicas do ASTRO CHAT: resolve o site pela chave, confere a
 * origem (TR-1), a pausa (TR-7/TR-8) e o token do visitante (TR-3).
 */

export const VISITOR_HEADER = "x-astro-visitor";

const publicSiteSelect = {
  id: true,
  organizationId: true,
  trackingId: true,
  statusId: true,
  name: true,
  allowedOrigins: true,
  isEnabled: true,
  pausedReason: true,
  aiEnabled: true,
  assistantName: true,
  greeting: true,
  accentColor: true,
  avatarUrl: true,
  widgetTheme: true,
  position: true,
  privacyUrl: true,
  organization: {
    select: { name: true, logo: true, starsSuspendedAt: true },
  },
} as const;

export type PublicSite = NonNullable<
  Awaited<ReturnType<typeof findSiteByPublicKey>>
>;

export type GateFailure = { status: number; error: string };

function findSiteByPublicKey(publicKey: string) {
  return prisma.astroChatSite.findUnique({
    where: { publicKey },
    select: publicSiteSelect,
  });
}

export function readRequestOrigin(request: NextRequest): string | null {
  return request.headers.get("origin");
}

export function readClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function readIpHash(request: NextRequest): string {
  return hashIp(readClientIp(request));
}

/** CORS só para a origem cadastrada — o navegador descarta a resposta nos demais sites. */
export function corsHeaders(allowedOrigin: string | null): Record<string, string> {
  if (!allowedOrigin) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": `content-type, ${VISITOR_HEADER}`,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; origin: string | null },
): NextResponse {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...corsHeaders(init.origin), "Cache-Control": "no-store" },
  });
}

export async function resolvePublicSite(
  publicKey: string,
  origin: string | null,
): Promise<{ site: PublicSite } | GateFailure> {
  if (!isPublicKeyShape(publicKey)) return { status: 404, error: "not_found" };
  const site = await findSiteByPublicKey(publicKey);
  if (!site) return { status: 404, error: "not_found" };
  if (!isOriginAllowed(origin, site.allowedOrigins)) {
    return { status: 403, error: "origin_not_allowed" };
  }
  if (!site.isEnabled || site.pausedReason || site.organization.starsSuspendedAt) {
    return { status: 403, error: "paused" };
  }
  if (!site.trackingId) return { status: 403, error: "not_configured" };
  return { site };
}

export function isGateFailure<Value extends object>(
  result: Value | GateFailure,
): result is GateFailure {
  return "error" in result && "status" in result;
}

export async function resolveVisitor(request: NextRequest, siteId: string) {
  const token = request.headers.get(VISITOR_HEADER);
  if (!token || token.length < 30 || token.length > 100) return null;
  const visitor = await prisma.astroChatVisitor.findUnique({
    where: { tokenHash: hashVisitorToken(token) },
    select: { id: true, siteId: true, leadId: true, ipHash: true, createdAt: true },
  });
  if (!visitor || visitor.siteId !== siteId) return null;
  return visitor;
}

export type PublicVisitor = NonNullable<Awaited<ReturnType<typeof resolveVisitor>>>;

/** Preflight CORS: responde só para origem cadastrada. */
export async function handlePreflight(
  request: NextRequest,
  publicKey: string,
): Promise<NextResponse> {
  const origin = readRequestOrigin(request);
  const site = isPublicKeyShape(publicKey) ? await findSiteByPublicKey(publicKey) : null;
  const isAllowed = !!site && isOriginAllowed(origin, site.allowedOrigins);
  return new NextResponse(null, {
    status: isAllowed ? 204 : 403,
    headers: corsHeaders(isAllowed ? origin : null),
  });
}
