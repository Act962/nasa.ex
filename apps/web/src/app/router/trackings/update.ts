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
      // Aparência do KANBAN (view de pipeline).
      kanbanCardBackgroundColor: z.string().nullable().optional(),
      kanbanCardBorderColor: z.string().nullable().optional(),
      kanbanCardBackgroundOpacity: z.number().int().min(0).max(100).optional(),
      kanbanColumnBackgroundColor: z.string().nullable().optional(),
      kanbanColumnBorderColor: z.string().nullable().optional(),
      kanbanColumnBackgroundOpacity: z
        .number()
        .int()
        .min(0)
        .max(100)
        .optional(),
      kanbanBackgroundColor: z.string().nullable().optional(),
      kanbanBackgroundImage: z.string().nullable().optional(),
      kanbanBackgroundBlur: z.number().int().min(0).max(30).optional(),
      kanbanBackgroundOpacity: z.number().int().min(0).max(100).optional(),
    }),
  )
  .output(
    z.object({
      trackingName: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const trackingExists = await prisma.tracking.findUnique({
      where: { id: input.trackingId },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }

    const tracking = await prisma.tracking.update({
      where: { id: input.trackingId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.cardBorderColor !== undefined && { cardBorderColor: input.cardBorderColor }),
        ...(input.cardBackgroundImage !== undefined && { cardBackgroundImage: input.cardBackgroundImage }),
        ...(input.cardBackgroundBlur !== undefined && { cardBackgroundBlur: input.cardBackgroundBlur }),
        ...(input.cardBackgroundOpacity !== undefined && { cardBackgroundOpacity: input.cardBackgroundOpacity }),
        ...(input.kanbanCardBackgroundColor !== undefined && { kanbanCardBackgroundColor: input.kanbanCardBackgroundColor }),
        ...(input.kanbanCardBorderColor !== undefined && { kanbanCardBorderColor: input.kanbanCardBorderColor }),
        ...(input.kanbanCardBackgroundOpacity !== undefined && { kanbanCardBackgroundOpacity: input.kanbanCardBackgroundOpacity }),
        ...(input.kanbanColumnBackgroundColor !== undefined && { kanbanColumnBackgroundColor: input.kanbanColumnBackgroundColor }),
        ...(input.kanbanColumnBorderColor !== undefined && { kanbanColumnBorderColor: input.kanbanColumnBorderColor }),
        ...(input.kanbanColumnBackgroundOpacity !== undefined && { kanbanColumnBackgroundOpacity: input.kanbanColumnBackgroundOpacity }),
        ...(input.kanbanBackgroundColor !== undefined && { kanbanBackgroundColor: input.kanbanBackgroundColor }),
        ...(input.kanbanBackgroundImage !== undefined && { kanbanBackgroundImage: input.kanbanBackgroundImage }),
        ...(input.kanbanBackgroundBlur !== undefined && { kanbanBackgroundBlur: input.kanbanBackgroundBlur }),
        ...(input.kanbanBackgroundOpacity !== undefined && { kanbanBackgroundOpacity: input.kanbanBackgroundOpacity }),
      },
    });

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
