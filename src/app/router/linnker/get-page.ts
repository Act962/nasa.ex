import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getLinnkerPage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/linnker/pages/:id",
    summary: "Get a Linnker page by ID",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const page = await prisma.linnkerPage.findFirst({
      where: { id: input.id, organizationId },
      include: {
        links: { orderBy: { position: "asc" } },
        _count: { select: { scans: true } },
      },
    });

    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    return { page };
  });
