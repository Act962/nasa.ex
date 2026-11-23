import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import z from "zod";
import { cancelAgendaAppointment } from "@/features/agenda/server/appointment-commands";

export const cancelAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appointmentId: z.string().min(1, "Appointment ID is required"),
    }),
  )
  .handler(async ({ input, context }) => {
    const appointment = await cancelAgendaAppointment({ organizationId: context.org.id, actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      }, appointmentId: input.appointmentId });
    return { appointment };
  });
