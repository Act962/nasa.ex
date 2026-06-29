import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteDateAvailabilitySlot = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ slotId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const slot = await prisma.agendaDateAvailabilitySlot.delete({
      where: { id: input.slotId },
    });

    return { slot };
  });
