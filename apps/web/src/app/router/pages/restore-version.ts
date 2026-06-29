import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const restorePageVersion = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/restore",
    summary: "Restaurar snapshot de versão como draft atual",
  })
  .input(z.object({ id: z.string(), versionId: z.string() }))
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

    const version = await prisma.nasaPageVersion.findFirst({
      where: { id: input.versionId, pageId: input.id },
      select: { snapshot: true },
    });
    if (!version) throw errors.NOT_FOUND({ message: "Versão não encontrada" });

    const updated = await prisma.nasaPage.update({
      where: { id: input.id },
      data: { layout: version.snapshot as object },
    });
    return { page: updated };
  });
