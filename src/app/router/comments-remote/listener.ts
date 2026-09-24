import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { callTrpc } from "@/http/comments/client";
import { getCommentsConfig } from "./_helpers";
import { withCommentsErrorTracking } from "./_errors";

const listenerEnum = z.enum(["SMARTAI", "MESSAGE"]);

const create = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      automationId: z.string(),
      listener: listenerEnum,
      prompt: z.string(),
      reply: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "listener.create", "mutation", input),
    );
  });

const update = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      automationId: z.string(),
      listener: listenerEnum.optional(),
      prompt: z.string().optional(),
      reply: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "listener.update", "mutation", input),
    );
  });

export const commentsListenerRouter = { create, update };
