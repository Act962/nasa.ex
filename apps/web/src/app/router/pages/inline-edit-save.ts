import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { pageLayoutSchema } from "./_schemas";

export const inlineEditSave = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/inline-save",
    summary: "Salvar edição inline (modo edição no site publicado)",
  })
  .input(
    z.object({
      id: z.string(),
      layout: pageLayoutSchema,
      publish: z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: { id: true, userId: true },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    if (page.userId !== context.user.id) {
      throw errors.FORBIDDEN({ message: "Sem permissão para editar esta página" });
    }

    if (input.publish) {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.nasaPageVersion.create({
          data: {
            pageId: page.id,
            snapshot: input.layout as object,
            label: "Edição inline",
            createdBy: context.user.id,
          },
        });
        return tx.nasaPage.update({
          where: { id: page.id },
          data: {
            layout: input.layout as object,
            publishedLayout: input.layout as object,
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        });
      });
      return { page: updated, published: true };
    }

    const updated = await prisma.nasaPage.update({
      where: { id: page.id },
      data: { layout: input.layout as object },
    });
    return { page: updated, published: false };
  });
