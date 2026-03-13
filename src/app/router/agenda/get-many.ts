import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getManyAgendas = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "List all agendas",
    tags: ["Agenda"],
  })
  .handler(async ({ context }) => {
    const agendas = await prisma.agenda.findMany({
      where: {
        organizationId: context.org.id,
      },
    });

    return { agendas, organization: context.org };
  });
