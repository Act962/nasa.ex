import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const upsertDateAvailability = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ agendaId: z.string().min(1), date: z.string().min(1) }))
  .handler(async ({ input }) => {
    const dateAvailability = await prisma.agendaDateAvailability.upsert({
      where: { agendaId_date: { agendaId: input.agendaId, date: input.date } },
      create: {
        agendaId: input.agendaId,
        date: input.date,
        timeSlots: {
          create: [{ startTime: "08:00", endTime: "18:00", order: 0 }],
        },
      },
      update: {},
      include: { timeSlots: { orderBy: { order: "asc" } } },
    });

    return { dateAvailability };
  });
