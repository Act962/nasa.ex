import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";

export const createTimeSlots = base.use(requiredAuthMiddleware).route({
    method: "POST",
    path: "/agenda/timeslots/create",
    summary: "Create time slots",
})
    .input(z.object({
        agendaId: z.string(),
        dayOfWeek: z.nativeEnum(DayOfWeek),
        startTime: z.string(),
        endTime: z.string(),
    }))
    .handler(async ({ input, context, errors }) => {
        try {
            const timeSlots = await prisma.timeSlots.create({
                data: {
                    agendaId: input.agendaId,
                    dayOfWeek: input.dayOfWeek,
                    startTime: input.startTime,
                    endTime: input.endTime,
                },
            });

            return timeSlots;
        } catch (error) {
            throw errors.INTERNAL_SERVER_ERROR;
        }
    });