import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { callTrpc } from "@/http/comments/client";
import { getCommentsConfig } from "./_helpers";
import { withCommentsErrorTracking } from "./_errors";

const create = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      keyword: z.string(),
      automationId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "keyword.create", "mutation", input),
    );
  });

const deleteKeyword = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      automationId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "keyword.delete", "mutation", input),
    );
  });

export const commentsKeywordRouter = { create, delete: deleteKeyword };
