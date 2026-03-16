import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { DayOfWeek } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createTimeSlots = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/agenda/timeslots/create",
    summary: "Create time slots",
  })
  .input(
    z.object({
      agendaId: z.string(),
      dayOfWeek: z.enum(DayOfWeek),
      startTime: z.string(),
      endTime: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const timeSlots = await prisma.availabilityTimeSlot.create({
        data: {
          availabilityId: input.agendaId,
          startTime: input.startTime,
          endTime: input.endTime,
        },
      });

      return timeSlots;
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
