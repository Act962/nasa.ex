import prisma from "@/lib/prisma";
import z from "zod";
import { base } from "../middlewares/base";
import { requiredAuthMiddleware } from "./auth";

export const listTrackings = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List all trackings",
    tags: ["Trackings"],
  })
  .input(z.void())
  .handler(async ({ input, context, errors }) => {
    const { session, user, org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const trackings = await prisma.tracking.findMany({
      where: {
        organizationId: org?.id,
        participants: {
          some: {
            userId: user.id,
          },
        },
      },
    });
    return trackings;
  });

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
    const { session, user, org } = context;

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
