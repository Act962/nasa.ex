import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteDateAvailability = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ dateAvailabilityId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const deleted = await prisma.agendaDateAvailability.delete({
      where: { id: input.dateAvailabilityId },
    });

    return { deleted };
  });
