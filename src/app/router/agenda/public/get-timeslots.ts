import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import z from "zod";

dayjs.extend(isBetween);

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

    // Verificar se a data está bloqueada por override
    const dateOverride = await prisma.agendaDateOverride.findUnique({
      where: { agendaId_date: { agendaId: agenda.id, date: input.date } },
    });
    if (dateOverride?.isBlocked) {
      return { timeSlots: [] };
    }

    const requestedDate = dayjs(input.date, "YYYY-MM-DD");

    // Correcting day of week mapping if necessary
    const daysMap: Record<string, string> = {
      "0": "SUNDAY",
      "1": "MONDAY",
      "2": "TUESDAY",
      "3": "WEDNESDAY",
      "4": "THURSDAY",
      "5": "FRIDAY",
      "6": "SATURDAY",
    };
    const dayName = daysMap[requestedDate.day().toString()];

    const timeSlotRanges = await prisma.availabilityTimeSlot.findMany({
      where: {
        availability: {
          agendaId: agenda.id,
          dayOfWeek: dayName as any,
          isActive: true,
        },
      },
      orderBy: {
        order: "asc",
      },
    });

    const appointments = await prisma.appointment.findMany({
      where: {
        agendaId: agenda.id,
        startsAt: {
          gte: requestedDate.startOf("day").toDate(),
          lte: requestedDate.endOf("day").toDate(),
        },
        status: {
          not: "CANCELLED",
        },
      },
    });

    const generatedSlots: {
      id: string;
      startTime: string;
      fillTime: string;
    }[] = [];
    const now = dayjs();
    const isToday = requestedDate.isSame(now, "day");

    for (const range of timeSlotRanges) {
      let current = dayjs(
        `${requestedDate.format("YYYY-MM-DD")}T${range.startTime}`,
      );
      const end = dayjs(
        `${requestedDate.format("YYYY-MM-DD")}T${range.endTime}`,
      );

      // The user wants the end time to be inclusive as a start time
      // Ex: 8-12 with 60min duration show 8, 9, 10, 11, 12
      while (current.isBefore(end) || current.isSame(end)) {
        const slotStart = current;
        const slotEnd = current.add(agenda.slotDuration, "minute");

        // 1. Filter past slots if today
        if (isToday && slotStart.isBefore(now)) {
          current = slotEnd;
          continue;
        }

        // 2. Filter overlap with appointments
        const isOccupied = appointments.some((app) => {
          const appStart = dayjs(app.startsAt);
          const appEnd = dayjs(app.endsAt);
          // Overlap: slotStart < appEnd AND slotEnd > appStart
          return slotStart.isBefore(appEnd) && slotEnd.isAfter(appStart);
        });

        if (!isOccupied) {
          generatedSlots.push({
            id: `${range.id}-${slotStart.format("HHmm")}`,
            startTime: slotStart.format("HH:mm"),
            fillTime: slotEnd.format("HH:mm"),
          });
        }

        current = slotEnd;
      }
    }

    return {
      timeSlots: generatedSlots,
    };
  });
