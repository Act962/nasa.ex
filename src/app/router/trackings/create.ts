import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../auth";

export const createTracking = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
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
    const { user, org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const tracking = await prisma.tracking.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: org.id,
        participants: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    return {
      trackingName: tracking.name,
    };
  });
