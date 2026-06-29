import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { createId } from "@paralleldrive/cuid2";
import { enqueueMemberSync } from "@/features/sync/lib/emit";

export const joinViaInviteLink = base
  .use(requiredAuthMiddleware)
  .input(z.object({ token: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const link = await prisma.organizationInviteLink.findUnique({
      where: { token: input.token },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    if (!link) {
      throw new ORPCError("NOT_FOUND", { message: "Link de convite inválido" });
    }
    if (link.revokedAt) {
      throw new ORPCError("FORBIDDEN", { message: "Este link foi revogado" });
    }
    if (link.expiresAt.getTime() < Date.now()) {
      throw new ORPCError("FORBIDDEN", { message: "Este link expirou" });
    }

    const existing = await prisma.member.findFirst({
      where: { organizationId: link.organizationId, userId: context.user.id },
    });

    if (!existing) {
      const newMember = await prisma.member.create({
        data: {
          id: createId(),
          organizationId: link.organizationId,
          userId: context.user.id,
          role: link.role,
          createdAt: new Date(),
        },
      });

      // Replica o membro pro NERP — best-effort.
      await enqueueMemberSync(newMember.id);

      await prisma.organizationInviteLink.update({
        where: { id: link.id },
        data: { usesCount: { increment: 1 } },
      });

      await prisma.orgActivityLog.create({
        data: {
          organizationId: link.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          action: "member_joined_via_link",
          resource: link.id,
          resourceId: context.user.id,
          metadata: { role: link.role, linkId: link.id },
        },
      });
    }

    await prisma.session.updateMany({
      where: { userId: context.user.id, token: context.session.token },
      data: { activeOrganizationId: link.organizationId },
    });

    return {
      organization: link.organization,
      alreadyMember: !!existing,
    };
  });
