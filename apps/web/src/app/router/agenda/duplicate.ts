import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import z from "zod";

export const duplicateAgenda = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Duplicate an agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const agenda = await prisma.agenda.findUnique({
      where: {
        id: input.agendaId,
      },
      include: {
        availabilities: {
          include: {
            timeSlots: true,
          },
        },
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({
        message: "Agenda não encontrada",
      });
    }

    const agendaDuplicated = await prisma.agenda.create({
      data: {
        name: agenda.name + " (cópia)",
        description: agenda.description,
        slotDuration: agenda.slotDuration,
        trackingId: agenda.trackingId,
        organizationId: context.org.id,
        slug: slugify(agenda.name + "-copy"),
        responsibles: {
          create: {
            userId: context.user.id,
          },
        },

        availabilities: {
          create: agenda.availabilities.map((availability) => ({
            dayOfWeek: availability.dayOfWeek,
            isActive: availability.isActive,
            timeSlots: {
              create: availability.timeSlots.map((timeSlot) => ({
                startTime: timeSlot.startTime,
                endTime: timeSlot.endTime,
                order: timeSlot.order,
              })),
            },
          })),
        },
      },
    });

    return {
      agenda: agendaDuplicated,
    };
  });
