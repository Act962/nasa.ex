import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

export const removeMember = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ memberId: z.string() }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    const currentMember = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: context.user.id },
    });
    if (!currentMember || !["owner", "moderador"].includes(currentMember.role)) {
      throw new ORPCError("FORBIDDEN", { message: "Sem permissão para remover membros" });
    }

    const target = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: orgId },
      include: { user: true },
    });
    if (!target) throw new ORPCError("NOT_FOUND", { message: "Membro não encontrado" });

    // Cannot remove yourself if only owner
    if (target.userId === context.user.id && target.role === "owner") {
      const ownerCount = await prisma.member.count({ where: { organizationId: orgId, role: "owner" } });
      if (ownerCount <= 1) throw new ORPCError("BAD_REQUEST", { message: "Não é possível remover o único Master" });
    }

    await prisma.member.delete({ where: { id: input.memberId } });

    await prisma.orgActivityLog.create({
      data: {
        organizationId: orgId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        action: "member_removed",
        resource: target.user.email,
        resourceId: target.userId,
        metadata: { removedRole: target.role },
      },
    });

    return { success: true };
  });
