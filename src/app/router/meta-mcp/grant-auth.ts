import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { canManageMcpAuthorizations } from "@/lib/meta-mcp/authorization";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * Master/Moderador autoriza um admin/member a usar Astro Meta Ads.
 *
 * Idempotente: re-grant em registro revogado reativa (limpa revokedAt).
 */
export const grantAuth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      userId: z.string().min(1, "userId obrigatório"),
      notes: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const canManage = await canManageMcpAuthorizations(
      context.user.id,
      context.org.id,
    );
    if (!canManage) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas Master e Moderador podem autorizar membros.",
      });
    }

    // Verifica que o user-alvo é membro da org
    const member = await prisma.member.findFirst({
      where: { userId: input.userId, organizationId: context.org.id },
      select: { id: true, role: true, user: { select: { name: true, email: true } } },
    });
    if (!member) {
      throw new ORPCError("NOT_FOUND", {
        message: "Usuário não pertence a esta organização.",
      });
    }

    // Owner e moderador já são autorizados implicitamente — grant explícito
    // não é necessário, mas também não atrapalha (cria registro idempotente).
    const grant = await prisma.metaMcpAuthorization.upsert({
      where: {
        organizationId_userId: {
          organizationId: context.org.id,
          userId: input.userId,
        },
      },
      update: {
        revokedAt: null,
        notes: input.notes,
        authorizedById: context.user.id,
        authorizedAt: new Date(),
      },
      create: {
        organizationId: context.org.id,
        userId: input.userId,
        authorizedById: context.user.id,
        notes: input.notes,
      },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "meta-ads-mcp",
      featureKey: "meta_mcp.auth.granted",
      action: "meta_mcp.auth.granted",
      actionLabel: `Autorizou ${member.user.name} no Astro Meta Ads`,
      resourceId: input.userId,
      metadata: {
        targetUserId: input.userId,
        targetUserEmail: member.user.email,
        targetMemberRole: member.role,
        notes: input.notes,
      },
    });

    return { authorization: grant };
  });
