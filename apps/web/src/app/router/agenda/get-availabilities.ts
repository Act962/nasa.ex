import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const getAvailabilities = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Get an agenda availabilities",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const availabilities = await prisma.agendaAvailability.findMany({
      where: {
        agendaId: input.agendaId,
      },
      orderBy: {
        dayOfWeek: "asc",
      },
      include: {
        timeSlots: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    return { availabilities };
  });
