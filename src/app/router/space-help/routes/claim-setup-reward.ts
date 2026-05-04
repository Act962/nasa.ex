import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import { awardSetupRewards } from "../utils";

export const claimSetupReward = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const result = await awardSetupRewards({
      userId: context.user.id,
      orgId: context.org.id,
    });

    if ((result as any)?.claimed) {
      await logActivity({
        organizationId: context.org.id,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "space-help",
        subAppSlug: "spacehelp-setup",
        featureKey: "spacehelp.setup.reward.claimed",
        action: "spacehelp.setup.reward.claimed",
        actionLabel: "Resgatou a recompensa do Setup Inicial",
        metadata: result as any,
      });
    }

    return result;
  });
