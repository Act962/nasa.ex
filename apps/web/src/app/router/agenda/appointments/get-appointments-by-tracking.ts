import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getAppointmentsByTracking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { trackingId } = input;

    const appointments = await prisma.appointment.findMany({
      where: {
        trackingId,
        agenda: {
          organizationId: context.org.id,
        },
      },
      orderBy: { startsAt: "asc" },
      include: {
        agenda: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, email: true, phone: true } },
        orgProject: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            avatar: true,
          },
        },
      },
    });

    return { appointments };
  });
