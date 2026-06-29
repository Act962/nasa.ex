import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const toggleDateOverride = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Toggle blocked status for a specific date",
    tags: ["Agenda", "DateOverride"],
  })
  .input(
    z.object({
      agendaId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD"),
      isBlocked: z.boolean(),
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

    const dateOverride = await prisma.agendaDateOverride.upsert({
      where: {
        agendaId_date: {
          agendaId: input.agendaId,
          date: input.date,
        },
      },
      create: {
        agendaId: input.agendaId,
        date: input.date,
        isBlocked: input.isBlocked,
      },
      update: {
        isBlocked: input.isBlocked,
      },
    });

    return { dateOverride };
  });
