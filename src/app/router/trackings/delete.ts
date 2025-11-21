import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../auth";

export const deleteTracking = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND;
    }

    const result = await prisma.tracking.delete({
      where: {
        id: input.trackingId,
      },
    });

    return {
      trackingName: result.name,
    };
  });

export const updateTracking = base
  .use(requiredAuthMiddleware)
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
    const { org } = context;

    if (!org) {
      throw errors.BAD_REQUEST;
    }

    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND;
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

    return {
      trackingName: tracking.name,
    };
  });
