import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

export const deleteLinnkerLink = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    path: "/linnker/links/:id",
    summary: "Delete a Linnker link",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const link = await prisma.linnkerLink.findFirst({
      where: { id: input.id },
      include: { page: true },
    });
    if (!link || link.page.organizationId !== organizationId) {
      throw errors.NOT_FOUND({ message: "Link não encontrado" });
    }

    await prisma.linnkerLink.delete({ where: { id: input.id } });

    await logActivity({
      organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "linnker",
      subAppSlug: "linnker-links",
      featureKey: "linnker.link.deleted",
      action: "linnker.link.deleted",
      actionLabel: `Excluiu o link "${link.title}"`,
      resource: link.title,
      resourceId: link.id,
    });

    return { message: "Link excluído" };
  });
