import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { debitStars } from "@/features/stars/lib/star-service";
import { StarTransactionType } from "@/generated/prisma/client";
import z from "zod";
import { PAGES_STARS_COST, emptyLayout, intentEnum, slugSchema } from "./_schemas";

export const createPage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages",
    summary: "Criar nova página NASA (cobra 2000 Stars)",
  })
  .input(
    z.object({
      title: z.string().min(1).max(200),
      slug: slugSchema,
      description: z.string().max(500).optional(),
      intent: intentEnum.default("CUSTOM"),
      layerCount: z.union([z.literal(1), z.literal(2)]).default(1),
      palette: z.record(z.string(), z.string()).optional(),
      fontFamily: z.string().optional(),
      templateId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }

    const existing = await prisma.nasaPage.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (existing) {
      throw errors.BAD_REQUEST({ message: "Este slug já está em uso" });
    }

    let layoutSeed: unknown = emptyLayout(input.layerCount);
    let starsSeed: { palette?: unknown; fontFamily?: string | null } = {};
    if (input.templateId) {
      const tmpl = await prisma.nasaPage.findFirst({
        where: { id: input.templateId, isTemplate: true },
        select: {
          publishedLayout: true,
          layout: true,
          palette: true,
          fontFamily: true,
        },
      });
      if (!tmpl) {
        throw errors.NOT_FOUND({ message: "Template não encontrado" });
      }
      layoutSeed = tmpl.publishedLayout ?? tmpl.layout ?? layoutSeed;
      starsSeed = { palette: tmpl.palette, fontFamily: tmpl.fontFamily };
    }

    const debit = await debitStars(
      organizationId,
      PAGES_STARS_COST,
      StarTransactionType.APP_SETUP,
      `NASA Pages — criação de site "${input.title}"`,
      "pages",
      context.user.id,
    );
    if (!debit.success) {
      throw errors.BAD_REQUEST({
        message: `Saldo de Stars insuficiente (necessário ${PAGES_STARS_COST} ★)`,
      });
    }

    const page = await prisma.nasaPage.create({
      data: {
        organizationId,
        userId: context.user.id,
        title: input.title,
        slug: input.slug,
        description: input.description,
        intent: input.intent,
        layerCount: input.layerCount,
        palette: (input.palette ?? starsSeed.palette ?? {}) as object,
        fontFamily: input.fontFamily ?? starsSeed.fontFamily ?? null,
        layout: layoutSeed as object,
        starsSpent: PAGES_STARS_COST,
      },
    });

    return { page };
  });
