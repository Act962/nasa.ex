import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import dayjs from "dayjs";
import { z } from "zod";

export const createTimeSlot = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Create a new time slot",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      availabilityId: z.string().min(1),
      startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const availability = await prisma.agendaAvailability.findUnique({
      where: {
        id: input.availabilityId,
      },
    });

    if (!availability) {
      throw errors.BAD_REQUEST({ message: "Disponibilidade não encontrada" });
    }

    let { startTime, endTime } = input;

    if (!startTime || !endTime) {
      const lastTimeSlot = await prisma.availabilityTimeSlot.findFirst({
        where: { availabilityId: input.availabilityId },
        orderBy: { endTime: "desc" },
      });

      const [hours, minutes] = (lastTimeSlot?.endTime ?? "08:00")
        .split(":")
        .map(Number);
      const base = dayjs().hour(hours).minute(minutes).second(0);

      startTime = startTime ?? base.format("HH:mm");
      endTime = endTime ?? base.add(1, "hour").format("HH:mm");
    }

    if (startTime >= endTime) {
      throw errors.BAD_REQUEST({
        message: "O horário de início deve ser menor que o de fim",
      });
    }

    // Overlap check
    const overlapping = await prisma.availabilityTimeSlot.findFirst({
      where: {
        availabilityId: input.availabilityId,
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      throw errors.BAD_REQUEST({ message: "O horário selecionado sobrepõe um intervalo existente" });
    }

    const timeslot = await prisma.availabilityTimeSlot.create({
      data: {
        availabilityId: input.availabilityId,
        startTime,
        endTime,
      },
    });

    // Reorder all slots for consistency
    const allSlots = await prisma.availabilityTimeSlot.findMany({
      where: { availabilityId: input.availabilityId },
      orderBy: { startTime: "asc" },
    });

    for (let i = 0; i < allSlots.length; i++) {
      await prisma.availabilityTimeSlot.update({
        where: { id: allSlots[i].id },
        data: { order: i + 1 },
      });
    }

    return { timeslots: timeslot };
  });
