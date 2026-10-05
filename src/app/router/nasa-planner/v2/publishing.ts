import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { assertPostAccess, resolvePlannerOrganizationIds } from "@/features/nasa-planner/server/cross-org";
import { requestImmediatePublish, schedulePlannerPost, unschedulePlannerPost } from "@/features/nasa-planner/server/scheduling";
import { listPublishAccounts } from "@/features/nasa-planner/server/publishing/publish-accounts";
import { getPlannerPostMetrics } from "@/features/nasa-planner/server/publishing/post-metrics";
import { logActivity } from "@/features/admin/lib/activity-logger";

/** Programar, reprogramar, desprogramar, publicar agora e tentar de novo (spec 0057). A permissão é checada na org do post. */

async function logScheduleActivity(user: { id: string; name: string; email: string; image?: string | null }, post: { id: string; organizationId: string }, actionLabel: string) {
  await logActivity({
    organizationId: post.organizationId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userImage: user.image ?? null,
    appSlug: "nasa-planner",
    subAppSlug: "planner-posts",
    featureKey: "planner.post.scheduled",
    action: "planner.post.scheduled",
    actionLabel,
    resourceId: post.id,
  }).catch(() => undefined);
}

export const schedule = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), scheduledAt: z.coerce.date() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    const post = await schedulePlannerPost(input.postId, input.scheduledAt);
    await logScheduleActivity(context.user, post, `Programou um post para ${input.scheduledAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
    return { post };
  });

export const unschedule = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    const post = await unschedulePlannerPost(input.postId);
    return { post };
  });

export const publishNow = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    const post = await requestImmediatePublish(input.postId, "PUBLISH_NOW");
    await logScheduleActivity(context.user, post, "Mandou publicar um post agora");
    return { post };
  });

export const retryPublish = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    const post = await requestImmediatePublish(input.postId, "RETRY");
    return { post };
  });

export const listAccounts = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationIds: z.array(z.string()).max(50).optional() }).optional())
  .handler(async ({ input, context }) => {
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input?.organizationIds);
    return { accounts: await listPublishAccounts(organizationIds) };
  });

/** Curtidas, comentários e alcance do post publicado, lidos na hora da Meta. */
export const postMetrics = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "view");
    return getPlannerPostMetrics(input.postId);
  });
