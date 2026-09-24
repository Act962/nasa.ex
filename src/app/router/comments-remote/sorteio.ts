import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { callTrpc } from "@/http/comments/client";
import { getCommentsConfig } from "./_helpers";
import { withCommentsErrorTracking } from "./_errors";

const mediaTypeSchema = z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]);

const rulesSchema = z
  .object({
    dedupePerUser: z.boolean().optional(),
    minWords: z.number().int().nonnegative().optional(),
    requireMention: z.boolean().optional(),
  })
  .optional();

const create = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ title: z.string().min(1).max(120) }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.create", "mutation", input),
    );
  });

const getMany = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.getMany", "query", undefined),
    );
  });

const getOne = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.getOne", "query", input),
    );
  });

const update = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      title: z.string().min(1).max(120).optional(),
      prizeName: z.string().max(120).nullish(),
      prizeDescription: z.string().max(2000).nullish(),
      prizeImage: z.string().url().nullish(),
      winnersCount: z.number().int().min(1).max(100).optional(),
      rules: rulesSchema,
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.update", "mutation", input),
    );
  });

const deleteSorteio = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.delete", "mutation", input),
    );
  });

const addPosts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      posts: z.array(
        z.object({
          postId: z.string(),
          caption: z.string().optional(),
          media: z.string(),
          mediaUrl: z.string().optional(),
          permalink: z.string().optional(),
          mediaType: mediaTypeSchema,
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.addPosts", "mutation", input),
    );
  });

const removePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), postId: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.removePost", "mutation", input),
    );
  });

const startCollecting = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.startCollecting", "mutation", input),
    );
  });

const closeCollecting = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.closeCollecting", "mutation", input),
    );
  });

const resync = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.resync", "mutation", input),
    );
  });

const listComments = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      cursor: z.string().nullish(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.listComments", "query", input),
    );
  });

const draw = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      count: z.number().int().min(1).max(50).default(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.draw", "mutation", input),
    );
  });

const replaceWinner = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), winnerId: z.string() }))
  .handler(async ({ input, context }) => {
    const { integrationId, config } = await getCommentsConfig(context.org.id);
    return withCommentsErrorTracking(integrationId, () =>
      callTrpc(config, "sorteio.replaceWinner", "mutation", input),
    );
  });

export const commentsSorteioRouter = {
  create,
  getMany,
  getOne,
  update,
  delete: deleteSorteio,
  addPosts,
  removePost,
  startCollecting,
  closeCollecting,
  resync,
  listComments,
  draw,
  replaceWinner,
};
