import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";

export const listAllTrackings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "List all trackings",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      organizationionIds: z.array(z.string()),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    try {
      const { user, org } = context;

      const trackings = await prisma.tracking.findMany({
        where: {
          organizationId: { in: input.organizationionIds },
          participants: {
            some: {
              userId: user.id,
            },
          },
        },
        include: {
          whatsappInstance: {
            select: {
              id: true,
              instanceId: true,
              status: true,
              apiKey: true,
              phoneNumber: true,
              isBusiness: true,
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
