import { auth } from "@/lib/auth";
import { AUTH_BASE_PATH, MCP_PATH, resolveAuthOrigin } from "@/features/external-ai/server/oauth-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descoberta do OAuth das IAs externas (spec 0135, RF-3). O better-auth serve os documentos sob
 * /api/auth; as IAs os procuram na raiz, com o caminho do recurso ou do emissor no fim
 * (RFC 9728 e RFC 8414). Qualquer origem pode ler: as IAs leem dos próprios apps.
 */

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type, Mcp-Protocol-Version",
};

// O plugin `mcp` responde o documento do recurso no próprio caminho da raiz; os do servidor de
// autorização ficam sob /api/auth.
const BETTER_AUTH_PATH_BY_DOCUMENT: Record<string, string> = {
  [`oauth-protected-resource${MCP_PATH}`]: `/.well-known/oauth-protected-resource${MCP_PATH}`,
  "oauth-protected-resource": "/.well-known/oauth-protected-resource",
  [`oauth-authorization-server${AUTH_BASE_PATH}`]: `${AUTH_BASE_PATH}/.well-known/oauth-authorization-server`,
  "oauth-authorization-server": `${AUTH_BASE_PATH}/.well-known/oauth-authorization-server`,
  [`openid-configuration${AUTH_BASE_PATH}`]: `${AUTH_BASE_PATH}/.well-known/openid-configuration`,
  "openid-configuration": `${AUTH_BASE_PATH}/.well-known/openid-configuration`,
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const betterAuthPath = BETTER_AUTH_PATH_BY_DOCUMENT[path.join("/")];
  if (!betterAuthPath) return new Response(null, { status: 404, headers: CORS_HEADERS });

  const response = await auth.handler(new Request(`${resolveAuthOrigin()}${betterAuthPath}`));
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
