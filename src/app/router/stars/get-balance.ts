import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { checkBalance } from "@/lib/star-service";
import { z } from "zod";

export const getStarBalance = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .output(
    z.object({
      balance: z.number(),
      bonusBalance: z.number(),
      totalBalance: z.number(),
      planMonthlyStars: z.number(),
      planSlug: z.string(),
      planName: z.string(),
      cycleStart: z.date().nullable(),
      nextCycleDate: z.date().nullable(),
    })
  )
  .handler(async ({ context }) => {
    return checkBalance(context.org.id);
  });
