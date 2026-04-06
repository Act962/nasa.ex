import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const deleteCard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ cardId: z.string() }))
  .handler(async ({ input, context }) => {
    // First verify ownership
    const existing = await prisma.nasaPlannerCard.findFirst({
      where: { id: input.cardId, mindMap: { planner: { organizationId: context.org.id } } },
    });
    if (!existing) throw new ORPCError("NOT_FOUND", { message: "Card não encontrado" });

    await prisma.nasaPlannerCard.delete({
      where: { id: input.cardId },
    });

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-planner",
      action: "planner.card.deleted",
      actionLabel: `Excluiu o card "${existing.title}" do planner`,
      resource: existing.title,
      resourceId: input.cardId,
    });

    return { ok: true };
  });
