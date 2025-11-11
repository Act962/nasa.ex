import prisma from "@/lib/prisma";
import z from "zod";
import { base } from "../middlewares/base";
import { requiredAuthMiddleware } from "./auth";

export const listTrackings = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/trackings",
    summary: "List all trackings",
    tags: ["Trackings"],
  })
  .input(z.void())
  .handler(async ({ input, context }) => {
    const { auth, org } = context;

    const trackings = await prisma.tracking.findMany({
      where: {
        organizationId: org?.id,
        participants: {
          some: {
            userId: auth.user.id,
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
    path: "/trackings",
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
  .handler(async ({ input, context }) => {
    const { auth, org } = context;

    if (!org) {
      throw new Error("TESTE");
    }

    const tracking = await prisma.tracking.create({
      data: {
        name: input.name,
        description: input.description,
        organizationId: org.id,
        participants: {
          create: {
            userId: auth.user.id,
            role: "OWNER",
          },
        },
      },
    });

    return {
      trackingName: tracking.name,
    };
  });
