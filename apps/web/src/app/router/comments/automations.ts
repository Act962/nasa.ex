import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { callTrpc } from "@/http/comments/client";
import { getCommentsConfig } from "./_helpers";
import { withCommentsErrorTracking } from "./_errors";

const mediaTypeSchema = z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]);

const create = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ name: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.create", "mutation", input),
    );
  });

const getMany = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.getMany", "query", undefined),
    );
  });

const getOne = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.getOne", "query", input),
    );
  });

const deleteAutomation = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.delete", "mutation", input),
    );
  });

const updateName = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), name: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.updateName", "mutation", input),
    );
  });

const updateActive = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), active: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.updateActive", "mutation", input),
    );
  });

const savePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      automationId: z.string(),
      posts: z.array(
        z.object({
          postId: z.string(),
          caption: z.string().optional(),
          media: z.string(),
          mediaType: mediaTypeSchema,
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.savePost", "mutation", input),
    );
  });

const deletePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.deletePost", "mutation", input),
    );
  });

const updateIntegrationToken = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      expire: z.coerce.date(),
      token: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "automations.updateIntegrationToken", "mutation", input),
    );
  });

export const commentsAutomationsRouter = {
  create,
  getMany,
  getOne,
  delete: deleteAutomation,
  updateName,
  updateActive,
  savePost,
  deletePost,
  updateIntegrationToken,
};
