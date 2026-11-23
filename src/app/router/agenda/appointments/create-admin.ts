import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import z from "zod";
import { createAgendaAppointment } from "@/features/agenda/server/appointment-commands";

export const createAdminAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Create an appointment from the admin panel",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string().min(1, "Agenda ID is required"),
      date: z.string().min(1, "Date is required"), // YYYY-MM-DD
      time: z.string().min(1, "Time is required"), // HH:mm
      name: z.string().min(1, "Name is required"),
      title: z.string().optional(),
      phone: z.string().min(1, "Phone is required"),
      email: z.email("Email inválido").optional().or(z.literal("")),
      notes: z.string().optional(),
      timeZone: z.string().optional(),
      meetingType: z.enum(["ONLINE", "IN_PERSON"]).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const appointment = await createAgendaAppointment({ organizationId: context.org.id, actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      }, input });
    return { success: true, appointment };
  });
