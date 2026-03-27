import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteStatus = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      statusId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const status = await prisma.status.findUnique({
      where: {
        id: input.statusId,
      },
      select: {
        leads: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!status) {
      throw errors.NOT_FOUND({
        message: "Status não encontrado",
      });
    }

    if (status.leads.length > 0) {
      throw errors.BAD_REQUEST({
        message: "Não é possível deletar uma coluna que possui leads",
      });
    }

    return await prisma.status.delete({
      where: {
        id: input.statusId,
      },
    });
  });
