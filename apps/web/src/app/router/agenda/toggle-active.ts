import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const toggleActiveAgenda = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Toggle active agenda",
    tags: ["Agenda"],
  })
  .input(
    z.object({
      agendaId: z.string(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const agenda = await prisma.agenda.findUnique({
      where: {
        id: input.agendaId,
      },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({
        message: "Agenda não encontrada",
      });
    }

    const updatedAgenda = await prisma.agenda.update({
      where: {
        id: input.agendaId,
      },
      data: {
        isActive: input.isActive,
      },
    });

    return {
      agenda: updatedAgenda,
    };
  });
