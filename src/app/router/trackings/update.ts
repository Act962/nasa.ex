import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";

export const updateTracking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PUT",
    summary: "Update a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      // Apêrencia do card no dashboard de Tracking.
      cardBorderColor: z.string().nullable().optional(),
      cardBackgroundImage: z.string().nullable().optional(),
      // Raio do filter blur em px (0-30). Default no DB = 8.
      cardBackgroundBlur: z.number().int().min(0).max(30).optional(),
      // Opacidade da imagem em % (0-100). Default no DB = 25.
      cardBackgroundOpacity: z.number().int().min(0).max(100).optional(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND({
        message: "Tracking não encontrado",
      });
    }

    // Update padrão pra campos conhecidos pelo Prisma client (name/desc).
    const tracking = await prisma.tracking.update({
      where: {
        id: input.trackingId,
      },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
      },
    });

    // Apêrencia (cor, imagem, blur, opacity) via $executeRaw — não
    // depende do Prisma client ter sido regenerado. Se as colunas ainda
    // não existirem (migration não aplicada), degrada graciosamente.
    if (
      input.cardBorderColor !== undefined ||
      input.cardBackgroundImage !== undefined ||
      input.cardBackgroundBlur !== undefined ||
      input.cardBackgroundOpacity !== undefined
    ) {
      try {
        if (input.cardBorderColor !== undefined) {
          await prisma.$executeRaw`UPDATE tracking SET card_border_color = ${input.cardBorderColor} WHERE id = ${input.trackingId}`;
        }
        if (input.cardBackgroundImage !== undefined) {
          await prisma.$executeRaw`UPDATE tracking SET card_background_image = ${input.cardBackgroundImage} WHERE id = ${input.trackingId}`;
        }
        if (input.cardBackgroundBlur !== undefined) {
          await prisma.$executeRaw`UPDATE tracking SET card_background_blur = ${input.cardBackgroundBlur} WHERE id = ${input.trackingId}`;
        }
        if (input.cardBackgroundOpacity !== undefined) {
          await prisma.$executeRaw`UPDATE tracking SET card_background_opacity = ${input.cardBackgroundOpacity} WHERE id = ${input.trackingId}`;
        }
      } catch (e) {
        console.warn(
          "[tracking.update] appearance columns missing — run pnpm prisma migrate deploy",
          e,
        );
      }
    }

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      action: "tracking.updated",
      actionLabel: `Atualizou o tracking "${tracking.name}"`,
      resource: tracking.name,
      resourceId: tracking.id,
    });

    return {
      trackingName: tracking.name,
    };
  });
