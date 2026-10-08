import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { assertPostAccess, resolvePlannerOrganizationIds } from "@/features/nasa-planner/server/cross-org";
import { requestImmediatePublish, schedulePlannerPost, unschedulePlannerPost } from "@/features/nasa-planner/server/scheduling";
import { MAX_GROUP_ACCOUNTS, MAX_STAGGER_MINUTES, publishGroupNow, schedulePublishGroup, unschedulePublishGroup } from "@/features/nasa-planner/server/publish-group";
import { listPublishAccounts } from "@/features/nasa-planner/server/publishing/publish-accounts";
import { getPlannerPostMetrics } from "@/features/nasa-planner/server/publishing/post-metrics";
import { logActivity } from "@/features/admin/lib/activity-logger";

/** Programar, reprogramar, desprogramar, publicar agora e tentar de novo (spec 0057). A permissão é checada na org do post. */

/** `scope: "group"` age em todas as contas do grupo (spec 0074, RF-10); o padrão continua sendo só o post pedido. */
const scopeInput = z.enum(["post", "group"]).default("post");

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
  .input(
    z.object({
      postId: z.string(),
      scheduledAt: z.coerce.date(),
      scope: scopeInput,
      staggerMinutes: z.number().int().min(0).max(MAX_STAGGER_MINUTES).default(0),
      /** Cartão arrastado no calendário ou no Kanban: restringe o grupo aos posts que o cartão representa. */
      groupPostIds: z.array(z.string()).max(MAX_GROUP_ACCOUNTS).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    const scheduledLabel = input.scheduledAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    if (input.scope === "group") {
      const { posts, skipped } = await schedulePublishGroup(input);
      await logScheduleActivity(context.user, posts[0], `Programou um conteúdo em ${posts.length} conta(s) para ${scheduledLabel}`);
      return { post: posts[0], scheduledCount: posts.length, skipped };
    }
    const post = await schedulePlannerPost(input.postId, input.scheduledAt);
    await logScheduleActivity(context.user, post, `Programou um post para ${scheduledLabel}`);
    return { post, scheduledCount: 1, skipped: [] };
  });

export const unschedule = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), scope: scopeInput }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    if (input.scope === "group") {
      await unschedulePublishGroup(input.postId);
      return { post: null };
    }
    const post = await unschedulePlannerPost(input.postId);
    return { post };
  });

export const publishNow = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), scope: scopeInput }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    if (input.scope === "group") {
      const { posts, skipped } = await publishGroupNow(input.postId);
      await logScheduleActivity(context.user, posts[0], `Mandou publicar um conteúdo agora em ${posts.length} conta(s)`);
      return { post: posts[0], scheduledCount: posts.length, skipped };
    }
    const post = await requestImmediatePublish(input.postId, "PUBLISH_NOW");
    await logScheduleActivity(context.user, post, "Mandou publicar um post agora");
    return { post, scheduledCount: 1, skipped: [] };
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
