import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { purchaseTopUp } from "@/lib/star-service";
import { z } from "zod";

export const purchaseStarPackage = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ packageId: z.string() }))
  .output(
    z.object({
      success: z.boolean(),
      newBalance: z.number(),
      starsAdded: z.number(),
    })
  )
  .handler(async ({ input, context }) => {
    return purchaseTopUp(context.org.id, input.packageId);
  });
