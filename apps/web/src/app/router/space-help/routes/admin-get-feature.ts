import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireModerator } from "../utils";

export const adminGetFeature = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const feature = await prisma.spaceHelpFeature.findUnique({
      where: { id: input.id },
      include: {
        category: { select: { id: true, slug: true, name: true } },
        steps: { orderBy: { order: "asc" } },
      },
    });
    if (!feature) throw new ORPCError("NOT_FOUND", { message: "Funcionalidade não encontrada" });
    return { feature };
  });
