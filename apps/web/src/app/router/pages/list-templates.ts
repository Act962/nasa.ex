import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { intentEnum } from "./_schemas";

export const listPageTemplates = base
  .use(optionalAuthMiddleware)
  .route({
    method: "GET",
    path: "/pages/templates",
    summary: "Listar templates NASA de páginas (públicos + da própria org)",
  })
  .input(
    z
      .object({
        intent: intentEnum.optional(),
        category: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.session?.activeOrganizationId ?? null;
    const where = {
      isTemplate: true,
      templateMarkedByModerator: true,
      ...(input?.intent ? { intent: input.intent } : {}),
      ...(input?.category ? { templateCategory: input.category } : {}),
      ...(organizationId
        ? { OR: [{ organizationId: { not: organizationId } }, { organizationId }] }
        : {}),
    };

    const templates = await prisma.nasaPage.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        intent: true,
        layerCount: true,
        ogImageUrl: true,
        templateCategory: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 60,
    });

    return { templates };
  });
