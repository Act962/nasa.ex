import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getManyDateAvailabilities = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ agendaId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const dateAvailabilities = await prisma.agendaDateAvailability.findMany({
      where: { agendaId: input.agendaId },
      include: {
        timeSlots: { orderBy: { order: "asc" } },
      },
      orderBy: { date: "asc" },
    });

    return { dateAvailabilities };
  });
