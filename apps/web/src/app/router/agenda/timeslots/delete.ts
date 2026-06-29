import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteTimeSlot = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete a time slot",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      timeSlotId: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const timeSlot = await prisma.availabilityTimeSlot.findUnique({
      where: {
        id: input.timeSlotId,
      },
      select: {
        availabilityId: true,
      },
    });

    if (!timeSlot) {
      throw errors.BAD_REQUEST({ message: "Horário não encontrado" });
    }

    const availability = await prisma.agendaAvailability.findUnique({
      where: {
        id: timeSlot.availabilityId,
      },
      select: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    });

    if (!availability) {
      throw errors.BAD_REQUEST({ message: "Disponibilidade não encontrada" });
    }

    const deletedTimeSlot = await prisma.availabilityTimeSlot.delete({
      where: {
        id: input.timeSlotId,
      },
    });

    // Reorder all remaining slots for consistency
    const remainingSlots = await prisma.availabilityTimeSlot.findMany({
      where: { availabilityId: timeSlot.availabilityId },
      orderBy: { startTime: "asc" },
    });

    for (let i = 0; i < remainingSlots.length; i++) {
      await prisma.availabilityTimeSlot.update({
        where: { id: remainingSlots[i].id },
        data: { order: i + 1 },
      });
    }

    return { deletedTimeSlot };
  });
