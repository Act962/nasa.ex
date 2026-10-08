import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import {
  MAX_GROUP_ACCOUNTS,
  getPublishGroupOverview,
  setPublishGroupAccounts,
  setPublishGroupDetached,
} from "@/features/nasa-planner/server/publish-group";

/** Mesmo conteúdo em várias contas do Instagram (spec 0074). A permissão é checada na org do post. */

export const getPublishGroup = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "view");
    return getPublishGroupOverview(input.postId);
  });

export const setGroupAccounts = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), instagramAccountIds: z.array(z.string()).min(1).max(MAX_GROUP_ACCOUNTS) }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "create");
    return setPublishGroupAccounts({ ...input, actorId: context.user.id });
  });

export const setGroupDetached = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), isDetached: z.boolean() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "create");
    await setPublishGroupDetached({ ...input, actorId: context.user.id });
    return { ok: true };
  });
