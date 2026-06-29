import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createDateAvailabilitySlot = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ dateAvailabilityId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const existing = await prisma.agendaDateAvailabilitySlot.findMany({
      where: { dateAvailabilityId: input.dateAvailabilityId },
      orderBy: { order: "asc" },
    });

    const lastSlot = existing[existing.length - 1];
    const startTime = lastSlot?.endTime ?? "08:00";
    const endTime = startTime >= "18:00" ? "23:00" : "18:00";

    const slot = await prisma.agendaDateAvailabilitySlot.create({
      data: {
        dateAvailabilityId: input.dateAvailabilityId,
        startTime,
        endTime,
        order: existing.length,
      },
    });

    return { slot };
  });
