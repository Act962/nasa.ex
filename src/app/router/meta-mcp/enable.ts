import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { canManageMcpAuthorizations } from "@/features/astro-meta-ads/server/authorization";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * Habilita o Astro Meta Ads (MCP) na organização.
 *
 * - Só master/moderador pode chamar
 * - Exige Meta integration ativa (OAuth conectado)
 * - Aplica defaults conservadores: leitura + pause/resume; orçamento R$ 500
 * - Idempotente: reabilitar quando já habilitado é ok
 */
export const enable = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const canManage = await canManageMcpAuthorizations(
      context.user.id,
      context.org.id,
    );
    if (!canManage) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas Master e Moderador podem habilitar o Astro Meta Ads.",
      });
    }

    const integration = await prisma.platformIntegration.findUnique({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: "META",
        },
      },
      select: { id: true, isActive: true, config: true },
    });

    if (!integration || !integration.isActive) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message:
          "Conecte uma conta Meta em Integrações antes de habilitar o Astro Meta Ads.",
      });
    }

    const existingConfig = (integration.config ?? {}) as Record<
      string,
      unknown
    >;
    // Spec 0125 (RF-8): só habilita quando o "Testar conexão" confirmou o MCP oficial.
    const connectionCheck = existingConfig.connectionCheck as
      | { canUseAstro?: boolean; astroBlockedReason?: string | null }
      | undefined;
    if (connectionCheck?.canUseAstro !== true) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message:
          connectionCheck?.astroBlockedReason ??
          "Teste a conexão da Meta nos Satélites antes de habilitar o Astro Meta Ads.",
      });
    }
    const newConfig = {
      ...existingConfig,
      mcpEnabled: true,
      mcpEnabledAt: new Date().toISOString(),
      mcpEnabledBy: context.user.id,
      // Defaults conservadores — só na PRIMEIRA habilitação
      mcpAllowedOps: existingConfig.mcpAllowedOps ?? [
        "read",
        "pause",
        "resume",
      ],
      mcpMaxBudgetPerCampaign: existingConfig.mcpMaxBudgetPerCampaign ?? 500,
      mcpDefaultModel: existingConfig.mcpDefaultModel ?? "openai:gpt-4.1-nano",
    };

    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: { config: newConfig },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "meta-ads-mcp",
      featureKey: "meta_mcp.enabled",
      action: "meta_mcp.enabled",
      actionLabel: `Habilitou Astro Meta Ads`,
      metadata: {
        allowedOps: newConfig.mcpAllowedOps,
        maxBudgetPerCampaign: newConfig.mcpMaxBudgetPerCampaign,
      },
    });

    return {
      enabled: true,
      config: {
        mcpAllowedOps: newConfig.mcpAllowedOps,
        mcpMaxBudgetPerCampaign: newConfig.mcpMaxBudgetPerCampaign,
        mcpDefaultModel: newConfig.mcpDefaultModel,
      },
    };
  });
