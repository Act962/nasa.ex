import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const updateTimeSlot = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Update a time slot",
    tags: ["Agenda"],
  })
  .input(
    z
      .object({
        timeSlotId: z.string().min(1),
        startTime: z
          .string()
          .regex(timeRegex, "Formato inválido, use HH:mm")
          .optional(),
        endTime: z
          .string()
          .regex(timeRegex, "Formato inválido, use HH:mm")
          .optional(),
      })
      .refine(
        (data) => {
          if (data.startTime && data.endTime) {
            return data.startTime < data.endTime;
          }
          return true;
        },
        {
          message: "O horário de início deve ser menor que o de fim",
          path: ["startTime"],
        },
      ),
  )
  .handler(async ({ input, errors }) => {
    const timeSlot = await prisma.availabilityTimeSlot.findUnique({
      where: { id: input.timeSlotId },
    });

    if (!timeSlot) {
      throw errors.NOT_FOUND({ message: "Time slot não encontrado" });
    }

    const startTime = input.startTime ?? timeSlot.startTime;
    const endTime = input.endTime ?? timeSlot.endTime;

    if (startTime >= endTime) {
      throw errors.BAD_REQUEST({
        message: "O horário de início deve ser menor que o de fim",
      });
    }

    // Overlap check
    const overlapping = await prisma.availabilityTimeSlot.findFirst({
      where: {
        availabilityId: timeSlot.availabilityId,
        id: { not: input.timeSlotId },
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

    const updated = await prisma.availabilityTimeSlot.update({
      where: { id: input.timeSlotId },
      data: { startTime, endTime },
    });

    // Reorder all slots for consistency
    const allSlots = await prisma.availabilityTimeSlot.findMany({
      where: { availabilityId: timeSlot.availabilityId },
      orderBy: { startTime: "asc" },
    });

    for (let i = 0; i < allSlots.length; i++) {
       await prisma.availabilityTimeSlot.update({
        where: { id: allSlots[i].id },
        data: { order: i + 1 },
      });
    }

    return { timeSlot: updated };
  });
