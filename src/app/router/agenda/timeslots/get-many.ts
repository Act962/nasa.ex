import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getManyTimeSlots = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "List all time slots by availability",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      availabilityId: z.string().min(1),
    }),
  )
  .handler(async ({ input }) => {
    const timeslots = await prisma.availabilityTimeSlot.findMany({
      where: {
        availabilityId: input.availabilityId,
      },
      orderBy: {
        order: "asc",
      },
    });

    return { timeslots };
  });
