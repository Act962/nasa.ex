import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { debitStars } from "@/features/stars/lib/star-service";
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

    const taken = await prisma.nasaPage.findUnique({
      where: { slug: input.newSlug },
      select: { id: true },
    });
    if (taken) throw errors.BAD_REQUEST({ message: "Este slug já está em uso" });

    const debit = await debitStars(
      organizationId,
      PAGES_STARS_COST,
      StarTransactionType.APP_SETUP,
      `NASA Pages — duplicação de "${src.title}" → "${input.newTitle}"`,
      "pages",
      context.user.id,
    );
    if (!debit.success) {
      throw errors.BAD_REQUEST({
        message: `Saldo de Stars insuficiente (necessário ${PAGES_STARS_COST} ★)`,
      });
    }

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
