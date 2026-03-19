import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getPublicAgenda = base
  .route({
    method: "GET",
    summary: "Get an agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaSlug: z.string().min(1, "Agenda slug is required"),
      orgSlug: z.string().min(1, "Organization slug is required"),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const agenda = await prisma.agenda.findFirst({
      where: {
        slug: input.agendaSlug,
        organization: {
          slug: input.orgSlug,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        slotDuration: true,
        trackingId: true,
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        availabilities: {
          select: {
            id: true,
            dayOfWeek: true,
            isActive: true,
          },
        },
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({
        message: "Agenda não encontrada",
      });
    }

    return {
      agenda,
    };
  });
