import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

export const revokeInviteLink = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    const currentMember = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
    });
    if (!currentMember || !["owner", "admin", "moderador"].includes(currentMember.role)) {
      throw new ORPCError("FORBIDDEN", { message: "Sem permissão para revogar links de convite" });
    }

    const link = await prisma.organizationInviteLink.findUnique({
      where: { id: input.id },
    });
    if (!link || link.organizationId !== orgId) {
      throw new ORPCError("NOT_FOUND", { message: "Link não encontrado" });
    }
    if (link.revokedAt) {
      return link;
    }

    const updated = await prisma.organizationInviteLink.update({
      where: { id: input.id },
      data: { revokedAt: new Date() },
    });

    await prisma.orgActivityLog.create({
      data: {
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        action: "invite_link_revoked",
        resource: updated.id,
        resourceId: updated.id,
      },
    });

    return updated;
  });
