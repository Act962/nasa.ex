import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const rejectShare = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ shareId: z.string() }))
  .handler(async ({ input, context }) => {
    const share = await prisma.actionShare.findFirst({
      where: { id: input.shareId, targetOrgId: context.org.id, status: "PENDING" },
    });
    if (!share) throw new Error("Pedido não encontrado ou já processado");

    // Verify master role
    const member = await prisma.member.findFirst({
      where: { userId: context.user.id, organizationId: context.org.id },
    });
    if (!member || member.role !== "owner") {
      throw new Error("Apenas o master pode rejeitar compartilhamentos");
    }

    const updatedShare = await prisma.actionShare.update({
      where: { id: share.id },
      data: {
        status: "REJECTED",
        rejectedBy: context.user.id,
        rejectedAt: new Date(),
      },
    });

    return { share: updatedShare };
  });
