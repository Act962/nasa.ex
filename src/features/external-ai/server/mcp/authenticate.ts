import "server-only";
import { authenticateExternalAiToken, isAccessKeyToken, readBearerToken, type ExternalAiCaller } from "../access-tokens";
import { findOAuthConnection } from "../oauth-connections";
import { verifyOAuthAccessToken } from "../oauth-token-verifier";
import { createMcpAccessContext, resolveAvailableApps, type McpApp } from "./apps";

/** Quem chama o /api/mcp (spec 0135, D-5): chave `orb_live_` ou IA por OAuth; empresas e apps valem pelo estado atual. */

const UNNAMED_AI = "IA conectada";

export async function authenticateMcpRequest(authorizationHeader: string | null): Promise<{ caller: ExternalAiCaller; apps: McpApp[] } | null> {
  const token = readBearerToken(authorizationHeader);
  if (!token) return null;

  if (isAccessKeyToken(token)) {
    const keyCaller = await authenticateExternalAiToken(token);
    if (!keyCaller) return null;
    const access = createMcpAccessContext(keyCaller.userId);
    const [apps, plannerOrganizationIds] = await Promise.all([resolveAvailableApps(access, keyCaller.scopes), access.plannerOrganizationIds()]);
    return {
      caller: {
        ...keyCaller,
        // A chave guarda as empresas da criação; o dono pode ter saído de alguma depois.
        organizationIds: keyCaller.organizationIds.filter((organizationId) => plannerOrganizationIds.includes(organizationId)),
        scopes: apps.map((app) => app.key),
      },
      apps,
    };
  }

  const holder = await verifyOAuthAccessToken(token);
  if (!holder) return null;
  // O JWT vale 1 h e não se revoga: sem o consentimento, a conexão foi desfeita (D-3, CB-4).
  const connection = await findOAuthConnection(holder.userId, holder.clientId);
  if (!connection) return null;

  const access = createMcpAccessContext(holder.userId);
  const [apps, plannerOrganizationIds] = await Promise.all([resolveAvailableApps(access), access.plannerOrganizationIds()]);
  return {
    caller: {
      credential: "oauth",
      tokenId: holder.clientId,
      label: connection.clientName?.trim() || UNNAMED_AI,
      userId: holder.userId,
      organizationIds: plannerOrganizationIds,
      scopes: apps.map((app) => app.key),
    },
    apps,
  };
}
