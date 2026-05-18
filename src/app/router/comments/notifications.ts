import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { callTrpc } from "@/http/comments/client";
import { getCommentsConfig } from "./_helpers";
import { withCommentsErrorTracking } from "./_errors";

const getMany = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "notifications.getMany", "query", undefined),
    );
  });

const markAsRead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "notifications.markAsRead", "mutation", input),
    );
  });

export const commentsNotificationsRouter = { getMany, markAsRead };
