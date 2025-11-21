import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listTrackings = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List all trackings",
    tags: ["Trackings"],
  })
  .input(z.void())
  .handler(async ({ context, errors }) => {
    const { user, org } = context;

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
