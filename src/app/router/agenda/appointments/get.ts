import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getAppointment = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      appointmentId: z.string().min(1, "Tracking é obrigatório"),
    }),
  )
  .handler(async ({ input }) => {
    const { appointmentId } = input;

    const appointment = await prisma.appointment.findUnique({
      where: {
        id: appointmentId,
      },
      include: {
        agenda: {
          include: {
            organization: { select: { slug: true } },
            responsibles: {
              select: {
                userId: true,
              },
            },
          },
        },
        lead: true,
        tracking: true,
        user: true,
      },
    });

    return { appointment };
  });
