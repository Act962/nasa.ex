import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireModerator } from "../utils";

export const adminGetCategory = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const category = await prisma.spaceHelpCategory.findUnique({
      where: { id: input.id },
      include: {
        features: {
          orderBy: { order: "asc" },
          include: { _count: { select: { steps: true } } },
        },
      },
    });
    if (!category) throw new ORPCError("NOT_FOUND", { message: "Categoria não encontrada" });
    return { category };
  });
