import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createCalendarShare = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      plannerId: z.string(),
      expiresAt: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await prisma.nasaPlanner.findFirstOrThrow({
      where: { id: input.plannerId, organizationId: context.org.id },
    });

    // Deactivate old shares
    await prisma.nasaPlannerCalendarShare.updateMany({
      where: { plannerId: input.plannerId, isActive: true },
      data: { isActive: false },
    });

    const share = await prisma.nasaPlannerCalendarShare.create({
      data: {
        plannerId: input.plannerId,
        isActive: true,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });

    return { share };
  });
