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
    // Check if record already exists first (avoids upsert compound-key issues)
    const existing = await prisma.agendaDateAvailability.findUnique({
      where: { agendaId_date: { agendaId: input.agendaId, date: input.date } },
      include: { timeSlots: { orderBy: { order: "asc" } } },
    });

    if (existing) {
      return { dateAvailability: existing };
    }

    // Create new with a default time range
    const dateAvailability = await prisma.agendaDateAvailability.create({
      data: {
        agendaId: input.agendaId,
        date: input.date,
        timeSlots: {
          create: [{ startTime: "08:00", endTime: "18:00", order: 0 }],
        },
      },
      include: { timeSlots: { orderBy: { order: "asc" } } },
    });

    return { dateAvailability };
  });
