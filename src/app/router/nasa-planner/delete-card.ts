import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
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

    return { ok: true };
  });
