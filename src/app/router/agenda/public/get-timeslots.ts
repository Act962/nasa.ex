import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { computeAgendaTimeSlots } from "@/features/agenda/server/agenda-slots";

export const getPublicAgendaTimeSlots = base
  .route({
    method: "GET",
    summary: "Get an agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      date: z.string().min(1, "Date is required"), // ISO String
      agendaSlug: z.string().min(1, "Agenda slug is required"),
      orgSlug: z.string().min(1, "Organization slug is required"),
      includeUnavailable: z.boolean().optional(),
      timeZone: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const organization = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true },
    });

    if (!organization) {
      throw errors.NOT_FOUND({
        message: "Organization not found",
      });
    }

    const agenda = await prisma.agenda.findUnique({
      where: {
        slug_organizationId: {
          slug: input.agendaSlug,
          organizationId: organization.id,
        },
      },
      select: {
        id: true,
        slotDuration: true,
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({
        message: "Agenda não encontrada",
      });
    }

    const timeSlots = await computeAgendaTimeSlots({
      agenda,
      date: input.date,
      timeZone: input.timeZone,
      includeUnavailable: input.includeUnavailable,
    });

    return { timeSlots };
  });
