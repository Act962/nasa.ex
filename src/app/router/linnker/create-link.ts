import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

export const createLinnkerLink = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/linnker/links",
    summary: "Create a link inside a Linnker page",
  })
  .input(
    z.object({
      pageId: z.string(),
      title: z.string().min(1),
      url: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(["TRACKING", "FORM", "CHAT", "EXTERNAL", "AGENDA"]).optional(),
      emoji: z.string().optional(),
      imageUrl: z.string().optional(),
      displayStyle: z.enum(["button", "banner"]).optional(),
      color: z.string().optional(),
      position: z.number().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const page = await prisma.linnkerPage.findFirst({ where: { id: input.pageId, organizationId } });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    const maxPosition = await prisma.linnkerLink.count({ where: { pageId: input.pageId } });

    const link = await prisma.linnkerLink.create({
      data: {
        pageId: input.pageId,
        title: input.title,
        url: input.url,
        description: input.description,
        type: input.type ?? "EXTERNAL",
        emoji: input.emoji,
        imageUrl: input.imageUrl,
        displayStyle: input.displayStyle ?? "button",
        color: input.color,
        position: input.position ?? maxPosition,
      },
    });

    await logActivity({
      organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "linnker",
      subAppSlug: "linnker-links",
      featureKey: "linnker.link.created",
      action: "linnker.link.created",
      actionLabel: `Criou o link "${link.title}" na página "${page.title}"`,
      resource: link.title,
      resourceId: link.id,
      metadata: { pageId: page.id, linkType: link.type },
    });

    return { message: "Link criado com sucesso", link };
  });
