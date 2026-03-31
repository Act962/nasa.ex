import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const getCalendarShare = base
  .input(z.object({ token: z.string() }))
  .handler(async ({ input }) => {
    const share = await prisma.nasaPlannerCalendarShare.findFirst({
      where: {
        token: input.token,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        planner: {
          include: {
            posts: {
              where: { status: { in: ["SCHEDULED", "PUBLISHED"] } },
              include: { slides: true },
            },
            calendarShares: false,
          },
        },
      },
    });

    if (!share) throw new ORPCError("NOT_FOUND", { message: "Link inválido ou expirado" });

    return { planner: share.planner };
  });
