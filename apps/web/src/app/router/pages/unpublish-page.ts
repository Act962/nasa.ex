import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const unpublishPage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/unpublish",
    summary: "Despublicar página",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const existing = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: { id: true },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const page = await prisma.nasaPage.update({
      where: { id: input.id },
      data: { status: "DRAFT", publishedAt: null },
    });
    return { page };
  });
