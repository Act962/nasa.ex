import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";

export const listTrackings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "List all trackings",
    tags: ["Trackings"],
  })
  .input(z.void())
  .handler(async ({ context, errors }) => {
    try {
      const { user, org } = context;

      const trackings = await prisma.tracking.findMany({
        where: {
          organizationId: org?.id,
          participants: {
            some: {
              userId: user.id,
            },
          },
        },
        include: {
          whatsappInstances: {
            select: {
              id: true,
              instanceId: true,
              status: true,
            },
          },
        },
      });
      return trackings;
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
