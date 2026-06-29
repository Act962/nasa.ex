import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const getManyDateOverrides = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Get date overrides for an agenda",
    tags: ["Agenda", "DateOverride"],
  })
  .input(
    z.object({
      agendaId: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const agenda = await prisma.agenda.findUnique({
      where: { id: input.agendaId },
      select: { id: true },
    });

    if (!agenda) {
      throw errors.NOT_FOUND({ message: "Agenda não encontrada" });
    }

    const dateOverrides = await prisma.agendaDateOverride.findMany({
      where: { agendaId: input.agendaId },
      orderBy: { date: "asc" },
    });

    return { dateOverrides };
  });
