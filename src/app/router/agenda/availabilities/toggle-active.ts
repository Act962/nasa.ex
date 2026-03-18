import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const toggleActiveAvailability = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Toggle active availability",
    tags: ["Agenda", "Availability"],
  })
  .input(
    z.object({
      availabilityId: z.string(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const availability = await prisma.agendaAvailability.findUnique({
      where: {
        id: input.availabilityId,
      },
    });

    if (!availability) {
      throw errors.NOT_FOUND({
        message: "Disponibilidade não encontrada",
      });
    }

    const updatedAvailability = await prisma.agendaAvailability.update({
      where: {
        id: input.availabilityId,
      },
      data: {
        isActive: input.isActive,
      },
    });

    return {
      availability: updatedAvailability,
    };
  });
