import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { pageLayoutSchema } from "./_schemas";

export const updatePage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/pages/:id",
    summary: "Atualizar dados e layout da página (autosave)",
  })
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(500).optional().nullable(),
      faviconUrl: z.string().url().optional().nullable(),
      ogImageUrl: z.string().url().optional().nullable(),
      palette: z.record(z.string(), z.string()).optional(),
      fontFamily: z.string().optional().nullable(),
      layout: pageLayoutSchema.optional(),
      layerCount: z.union([z.literal(1), z.literal(2)]).optional(),
    }),
  )
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

    const { id, layout, ...rest } = input;
    const page = await prisma.nasaPage.update({
      where: { id },
      data: {
        ...rest,
        ...(layout ? { layout: layout as object } : {}),
      },
    });
    return { page };
  });
