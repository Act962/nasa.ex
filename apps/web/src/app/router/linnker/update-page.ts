import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import z from "zod";

export const updateLinnkerPage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/linnker/pages/:id",
    summary: "Update a Linnker page",
  })
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      bio: z.string().optional().nullable(),
      avatarUrl: z.string().optional().nullable(),
      coverColor: z.string().optional(),
      buttonStyle: z.enum(["rounded", "sharp", "pill"]).optional(),
      isPublished: z.boolean().optional(),
      bannerUrl: z.string().optional().nullable(),
      backgroundColor: z.string().optional().nullable(),
      backgroundImage: z.string().optional().nullable(),
      backgroundOpacity: z.number().min(0).max(1).optional(),
      socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).optional().nullable(),
      socialIconColor: z.string().optional().nullable(),
      titleColor: z.string().optional().nullable(),
      bioColor: z.string().optional().nullable(),
      // QR de contato (Fase 5 do plano)
      qrEnabled: z.boolean().optional(),
      qrMessageTemplate: z.string().max(500).optional().nullable(),
      // vCard overrides — editáveis pelo dono
      vcardOverrides: z
        .object({
          firstName: z.string().max(100).optional().nullable(),
          lastName: z.string().max(100).optional().nullable(),
          jobTitle: z.string().max(200).optional().nullable(),
          company: z.string().max(200).optional().nullable(),
          phone: z.string().max(30).optional().nullable(),
          email: z.string().max(200).optional().nullable(),
          birthday: z.string().max(10).optional().nullable(),
          website: z.string().max(500).optional().nullable(),
          notes: z.string().max(1000).optional().nullable(),
        })
        .optional()
        .nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { id, socialLinks, vcardOverrides, ...rest } = input;
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.BAD_REQUEST({ message: "Organization not found" });

    const page = await prisma.linnkerPage.findFirst({ where: { id, organizationId } });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    // Campo Json? requer Prisma.DbNull para setar SQL NULL (não JS null)
    const data = {
      ...rest,
      ...(socialLinks !== undefined
        ? { socialLinks: socialLinks === null ? Prisma.DbNull : socialLinks }
        : {}),
      ...(vcardOverrides !== undefined
        ? { vcardOverrides: vcardOverrides === null ? Prisma.DbNull : vcardOverrides }
        : {}),
    };

    const updated = await prisma.linnkerPage.update({
      where: { id },
      data,
      include: { links: { orderBy: { position: "asc" } } },
    });

    return { message: "Página atualizada", page: updated };
  });
