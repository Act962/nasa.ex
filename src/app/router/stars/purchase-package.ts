import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
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
    const result = await purchaseTopUp(context.org.id, input.packageId);

    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "system",
      action: "stars.purchased",
      actionLabel: `Comprou ${result.starsAdded} spaces (saldo: ${result.newBalance})`,
      metadata: { starsAdded: result.starsAdded, newBalance: result.newBalance },
    });

    return result;
  });
