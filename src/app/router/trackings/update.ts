import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import { logActivity } from "@/lib/activity-logger";

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
      name: z.string(),
      description: z.string().optional(),
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

    const tracking = await prisma.tracking.update({
      where: {
        id: input.trackingId,
      },
      data: {
        name: input.name,
        description: input.description,
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
