import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import z from "zod";

dayjs.extend(isBetween);
dayjs.extend(utc);
dayjs.extend(timezone);

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
    const includeUnavailable = !!input.includeUnavailable;
    const tz = input.timeZone || "America/Sao_Paulo";
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
    const isDateBlocked = !!dateOverride?.isBlocked;
    if (isDateBlocked && !includeUnavailable) {
      return { timeSlots: [] };
    }

    const requestedDate = dayjs.tz(input.date, "YYYY-MM-DD", tz);

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

    // Check for date-specific availability (overrides weekly schedule)
    const dateAvailability = await prisma.agendaDateAvailability.findUnique({
      where: { agendaId_date: { agendaId: agenda.id, date: input.date } },
      include: { timeSlots: { orderBy: { order: "asc" } } },
    });

    const timeSlotRanges = dateAvailability
      ? dateAvailability.timeSlots.map((s) => ({
          id: s.id,
          startTime: s.startTime,
          endTime: s.endTime,
        }))
      : await prisma.availabilityTimeSlot.findMany({
          where: {
            availability: {
              agendaId: agenda.id,
              dayOfWeek: dayName as any,
              isActive: true,
            },
          },
          orderBy: { order: "asc" },
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
      isOccupied: boolean;
      isPast: boolean;
      isBlocked: boolean;
    }[] = [];
    const now = dayjs().tz(tz);
    const isToday = requestedDate.isSame(now, "day");

    for (const range of timeSlotRanges) {
      let current = dayjs.tz(
        `${requestedDate.format("YYYY-MM-DD")}T${range.startTime}`,
        tz,
      );
      const end = dayjs.tz(
        `${requestedDate.format("YYYY-MM-DD")}T${range.endTime}`,
        tz,
      );

      // The user wants the end time to be inclusive as a start time
      // Ex: 8-12 with 60min duration show 8, 9, 10, 11, 12
      while (current.isBefore(end) || current.isSame(end)) {
        const slotStart = current;
        const slotEnd = current.add(agenda.slotDuration, "minute");

        const isPast = isToday && slotStart.isBefore(now);
        const isOccupied = appointments.some((app) => {
          const appStart = dayjs(app.startsAt);
          const appEnd = dayjs(app.endsAt);
          return slotStart.isBefore(appEnd) && slotEnd.isAfter(appStart);
        });

        if (includeUnavailable) {
          generatedSlots.push({
            id: `${range.id}-${slotStart.format("HHmm")}`,
            startTime: slotStart.format("HH:mm"),
            fillTime: slotEnd.format("HH:mm"),
            isOccupied,
            isPast,
            isBlocked: isDateBlocked,
          });
        } else if (!isPast && !isOccupied) {
          generatedSlots.push({
            id: `${range.id}-${slotStart.format("HHmm")}`,
            startTime: slotStart.format("HH:mm"),
            fillTime: slotEnd.format("HH:mm"),
            isOccupied: false,
            isPast: false,
            isBlocked: false,
          });
        }

        current = slotEnd;
      }
    }

    return {
      timeSlots: generatedSlots,
    };
  });
