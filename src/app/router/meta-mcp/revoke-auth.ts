import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { canManageMcpAuthorizations } from "@/lib/meta-mcp/authorization";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * Master/Moderador revoga a autorização de um user (soft-delete).
 * O registro fica preservado pra histórico.
 */
export const revokeAuth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ userId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const canManage = await canManageMcpAuthorizations(
      context.user.id,
      context.org.id,
    );
    if (!canManage) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas Master e Moderador podem revogar autorizações.",
      });
    }

    const grant = await prisma.metaMcpAuthorization.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.org.id,
          userId: input.userId,
        },
      },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!grant) {
      throw new ORPCError("NOT_FOUND", {
        message: "Autorização não encontrada para esse usuário.",
      });
    }

    const updated = await prisma.metaMcpAuthorization.update({
      where: { id: grant.id },
      data: { revokedAt: new Date() },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "meta-ads-mcp",
      featureKey: "meta_mcp.auth.revoked",
      action: "meta_mcp.auth.revoked",
      actionLabel: `Revogou autorização de ${grant.user.name} no Astro Meta Ads`,
      resourceId: input.userId,
      metadata: {
        targetUserId: input.userId,
        targetUserEmail: grant.user.email,
      },
    });

    return { revoked: true, authorization: updated };
  });
