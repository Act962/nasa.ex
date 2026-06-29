import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const getTrackingCardConfig = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "Get card config of a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      // Cast: modelo TrackingCardConfig só existe no client após `prisma generate`
      const config = await (
        prisma as unknown as {
          trackingCardConfig: {
            findUnique: (args: unknown) => Promise<unknown>;
          };
        }
      ).trackingCardConfig.findUnique({
        where: { trackingId: input.trackingId },
      });
      return { config: (config as unknown) ?? null };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
