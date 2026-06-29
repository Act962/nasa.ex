import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { callTrpc } from "@/http/comments/client";
import { getCommentsConfig } from "./_helpers";
import { withCommentsErrorTracking } from "./_errors";

const getIntegrations = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "integration.getIntegrations", "query", undefined),
    );
  });

export const commentsIntegrationRouter = { getIntegrations };
