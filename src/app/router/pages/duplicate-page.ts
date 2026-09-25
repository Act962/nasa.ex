import { meterOrThrow } from "@/features/stars/lib/metering";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { StarTransactionType } from "@/generated/prisma/client";
import z from "zod";
import { PAGES_STARS_COST, slugSchema } from "./_schemas";

export const duplicatePage = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/:id/duplicate",
    summary: "Duplicar página (cobra 2000 Stars)",
  })
  .input(
    z.object({
      id: z.string(),
      newSlug: slugSchema,
      newTitle: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const src = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
    });
    if (!src) throw errors.NOT_FOUND({ message: "Página de origem não encontrada" });

    // Duplicar SEMPRE cria top-level (subpages duplicam via createSubpage
    // do feature). `findFirst` porque `slug` perdeu `@unique` global —
    // partial unique index gerencia exclusividade.
    const taken = await prisma.nasaPage.findFirst({
      where: { slug: input.newSlug, parentPageId: null },
      select: { id: true },
    });
    if (taken) throw errors.BAD_REQUEST({ message: "Este slug já está em uso" });

    const debit = await meterOrThrow({
      organizationId,
      action: "page_duplicate",
      userId: context.user.id,
      appSlug: "pages",
      description: `ÓRBITA Pages — duplicação de "${src.title}" → "${input.newTitle}"`,
      feature: "pages.page_duplicate",
      transactionType: StarTransactionType.APP_SETUP,
    }, `Saldo de Stars insuficiente (necessário ${PAGES_STARS_COST} ★)`);

    const copy = await prisma.nasaPage.create({
      data: {
        organizationId,
        userId: context.user.id,
        title: input.newTitle,
        slug: input.newSlug,
        description: src.description,
        intent: src.intent,
        layerCount: src.layerCount,
        palette: src.palette as object,
        fontFamily: src.fontFamily,
        layout: src.layout as object,
        starsSpent: PAGES_STARS_COST,
      },
    });
    return { page: copy };
  });
