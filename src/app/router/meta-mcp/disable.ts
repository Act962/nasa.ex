import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { canManageMcpAuthorizations } from "@/lib/meta-mcp/authorization";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * Desabilita o Astro Meta Ads.
 * Mantém autorizações no banco (preservadas pra reativar depois sem perder grants).
 */
export const disable = base
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
        message: "Apenas Master e Moderador podem desabilitar o Astro Meta Ads.",
      });
    }

    const integration = await prisma.platformIntegration.findUnique({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: "META",
        },
      },
      select: { id: true, config: true },
    });
    if (!integration) return { enabled: false };

    const existingConfig = (integration.config ?? {}) as Record<string, unknown>;
    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: {
        config: { ...existingConfig, mcpEnabled: false },
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "meta-ads-mcp",
      featureKey: "meta_mcp.disabled",
      action: "meta_mcp.disabled",
      actionLabel: `Desabilitou Astro Meta Ads`,
    });

    return { enabled: false };
  });
