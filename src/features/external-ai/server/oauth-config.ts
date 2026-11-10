// Endereços do OAuth das IAs (spec 0135). Sem I/O no import (regra 24a).

export const MCP_PATH = "/api/mcp";
export const AUTH_BASE_PATH = "/api/auth";
export const CONNECT_PAGE_PATH = "/conectar-ia";

/** Uma conexão sem uso por esse tempo não renova mais o token: a IA pede o login de novo (RF-7). */
export const OAUTH_REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

export function resolveAuthOrigin(): string {
  return (process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

export const mcpResourceUrl = () => `${resolveAuthOrigin()}${MCP_PATH}`;
export const oauthIssuerUrl = () => `${resolveAuthOrigin()}${AUTH_BASE_PATH}`;
export const protectedResourceMetadataUrl = () => `${resolveAuthOrigin()}/.well-known/oauth-protected-resource${MCP_PATH}`;
