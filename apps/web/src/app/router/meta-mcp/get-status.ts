import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { checkMcpAuthorization } from "@/lib/meta-mcp/authorization";
import { z } from "zod";

/**
 * Status do Astro Meta Ads pra org + user atual.
 * Usado pela UI pra decidir o que mostrar (discovery card, settings,
 * card de não autorizado, etc.).
 */
export const getStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const integration = await prisma.platformIntegration.findUnique({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: "META",
        },
      },
      select: { isActive: true, config: true, lastSyncAt: true },
    });

    const config = (integration?.config ?? {}) as Record<string, unknown>;
    const metaConnected = integration?.isActive === true;
    const mcpEnabled = config.mcpEnabled === true;

    // Role do user
    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
      select: { role: true },
    });
    const role = member?.role ?? null;
    const canManage = role === "owner" || role === "moderador";

    // Autorização específica do user atual
    const auth = await checkMcpAuthorization(context.user.id, context.org.id);

    // Conta de membros autorizados (incl. owners/moderadores implícitos)
    const [implicitCount, explicitCount] = await Promise.all([
      prisma.member.count({
        where: {
          organizationId: context.org.id,
          role: { in: ["owner", "moderador"] },
        },
      }),
      prisma.metaMcpAuthorization.count({
        where: { organizationId: context.org.id, revokedAt: null },
      }),
    ]);

    return {
      metaConnected,
      mcpEnabled,
      currentUser: {
        role,
        canManage,
        authorized: auth.authorized,
        authorizationReason: auth.reason,
      },
      config: mcpEnabled
        ? {
            mcpAllowedOps:
              (config.mcpAllowedOps as string[] | undefined) ?? [
                "read",
                "pause",
                "resume",
              ],
            mcpMaxBudgetPerCampaign:
              (config.mcpMaxBudgetPerCampaign as number | undefined) ?? 500,
            mcpDefaultModel:
              (config.mcpDefaultModel as string | undefined) ??
              "openai:gpt-4.1-nano",
            mcpEnabledAt: (config.mcpEnabledAt as string | undefined) ?? null,
            mcpEnabledBy: (config.mcpEnabledBy as string | undefined) ?? null,
          }
        : null,
      authorizedMembersCount: implicitCount + explicitCount,
    };
  });
