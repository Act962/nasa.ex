import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { callTrpc } from "@/http/comments/client";
import { getCommentsConfig } from "./_helpers";
import { withCommentsErrorTracking } from "./_errors";

const upgrade = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      plan: z.literal("pro"),
      callbackUrl: z.string().min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "subscription.upgrade", "mutation", input),
    );
  });

const billingPortal = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ callbackUrl: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "subscription.billingPortal", "mutation", input),
    );
  });

const currentSubscription = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "subscription.currentSubscription", "query", undefined),
    );
  });

export const commentsSubscriptionRouter = {
  upgrade,
  billingPortal,
  currentSubscription,
};
