import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

export const publishPage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/publish",
    summary: "Publicar página (snapshot + status PUBLISHED)",
  })
  .input(z.object({ id: z.string(), label: z.string().optional() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const current = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
    });
    if (!current) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const page = await prisma.$transaction(async (tx) => {
      await tx.nasaPageVersion.create({
        data: {
          pageId: current.id,
          snapshot: current.layout as object,
          label: input.label,
          createdBy: context.user.id,
        },
      });
      return tx.nasaPage.update({
        where: { id: current.id },
        data: {
          publishedLayout: current.layout as object,
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });
    });

    await chargeStarsByAction(organizationId, "page_publish", {
      userId: context.user.id,
      description: `Publicou página`,
      appSlug: "pages",
    });

    return { page };
  });
