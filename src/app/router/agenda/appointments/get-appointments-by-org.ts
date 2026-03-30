import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getAppointmentsByOrg = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const appointments = await prisma.appointment.findMany({
      where: {
        agenda: {
          organizationId: context.org.id,
        },
      },
      orderBy: { startsAt: "asc" },
    });

    return { appointments };
  });
