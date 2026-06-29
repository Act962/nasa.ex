import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const updateLinnkerLink = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/linnker/links/:id",
    summary: "Update a Linnker link",
  })
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      url: z.string().optional(),
      description: z.string().optional().nullable(),
      type: z.enum(["TRACKING", "FORM", "CHAT", "EXTERNAL", "AGENDA"]).optional(),
      emoji: z.string().optional().nullable(),
      imageUrl: z.string().optional().nullable(),
      displayStyle: z.enum(["button", "banner"]).optional(),
      color: z.string().optional().nullable(),
      position: z.number().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, ...data } = input;
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const link = await prisma.linnkerLink.findFirst({
      where: { id },
      include: { page: true },
    });
    if (!link || link.page.organizationId !== organizationId) {
      throw errors.NOT_FOUND({ message: "Link não encontrado" });
    }

    const updated = await prisma.linnkerLink.update({ where: { id }, data });
    return { message: "Link atualizado", link: updated };
  });
