import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireModerator } from "../utils";

export const adminGetTrack = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const track = await prisma.spaceHelpTrack.findUnique({
      where: { id: input.id },
      include: {
        lessons: { orderBy: { order: "asc" } },
        rewardBadge: true,
        category: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!track) throw new ORPCError("NOT_FOUND", { message: "Trilha não encontrada" });
    return { track };
  });
