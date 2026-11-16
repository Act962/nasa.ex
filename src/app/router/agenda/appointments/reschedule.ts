import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import z from "zod";
import { rescheduleAgendaAppointment } from "@/features/agenda/server/appointment-commands";

export const rescheduleAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Reschedule an appointment via drag and drop",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      appointmentId: z.string().min(1),
      startsAt: z.string().min(1), // ISO string
      endsAt: z.string().min(1),   // ISO string
    }),
  )
  .handler(async ({ input, context }) => {
    const appointment = await rescheduleAgendaAppointment({
      organizationId: context.org.id,
      actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      },
      appointmentId: input.appointmentId,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
    return { appointment };
  });
