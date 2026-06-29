import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateDateAvailabilitySlot = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      slotId: z.string().min(1),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const slot = await prisma.agendaDateAvailabilitySlot.update({
      where: { id: input.slotId },
      data: {
        ...(input.startTime !== undefined && { startTime: input.startTime }),
        ...(input.endTime !== undefined && { endTime: input.endTime }),
      },
    });

    return { slot };
  });
