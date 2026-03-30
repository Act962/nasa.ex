import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { getAppCost } from "@/lib/star-service";
import { z } from "zod";

export const getAppStarCost = base
  .use(requiredAuthMiddleware)
  .input(z.object({ appSlug: z.string() }))
  .output(
    z.object({
      appSlug: z.string(),
      monthlyCost: z.number(),
      setupCost: z.number(),
      priceBrl: z.number().nullable(),
    }).nullable()
  )
  .handler(async ({ input }) => {
    return getAppCost(input.appSlug);
  });
