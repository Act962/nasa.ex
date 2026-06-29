import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listPageVersions = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/pages/:id/versions",
    summary: "Listar versões publicadas da página",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: { id: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const versions = await prisma.nasaPageVersion.findMany({
      where: { pageId: input.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, createdBy: true, createdAt: true },
      take: 50,
    });

    return { versions };
  });
