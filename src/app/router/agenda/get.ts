import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import z from "zod";

export const getAgenda = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Get an agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const agenda = await prisma.agenda.findUnique({
      where: {
        id: input.agendaId,
      },
      include: {
        availabilities: {
          include: {
            timeSlots: true,
          },
        },
        organization: {
          select: {
            slug: true,
          },
        },
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({
        message: "Agenda não encontrada",
      });
    }

    return {
      agenda,
    };
  });
