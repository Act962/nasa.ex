import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getTrackingIdleAutomation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Get idle automation config of a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const config = await prisma.trackingIdleAutomation.findUnique({
        where: { trackingId: input.trackingId },
      });
      return { config: config ?? null };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
