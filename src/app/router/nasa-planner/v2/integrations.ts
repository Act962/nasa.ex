import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { audienceFilterSchema, broadcastTemplateParamSchema } from "@/features/campanhas/schema/broadcast-schemas";
import {
  assertPlannerOrganizationAccess,
  assertPostAccess,
  resolvePlannerOrganizationIds,
} from "@/features/nasa-planner/server/cross-org";
import { getPlannerCommentsStatus, savePlannerCommentsAutomation } from "@/features/nasa-planner/server/comments-link";
import {
  createScheduledBroadcast,
  listApprovedTemplates,
  listCalendarBroadcasts,
} from "@/features/nasa-planner/server/whatsapp-broadcast";

/** Fase 2 do Planner: Comments por post (spec 0059) e disparo de WhatsApp (spec 0060), sempre na org do recurso. */

const MAX_RANGE_DAYS = 62;
const DAY_MS = 24 * 60 * 60 * 1000;

export const getPostComments = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const { post } = await assertPostAccess(context.user.id, input.postId, "view");
    const canEditComments = await hasAppPermission(post.organizationId, context.user.id, "comments", "canEdit");
    return { ...(await getPlannerCommentsStatus(input.postId)), canEditComments };
  });

export const savePostComments = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      postId: z.string(),
      respondToAnyComment: z.boolean(),
      keywords: z.array(z.string().trim().max(60)).max(30).default([]),
      excludedKeywords: z.array(z.string().trim().max(60)).max(30).default([]),
      directMessageText: z.string().trim().max(1000),
      buttonTitle: z.string().trim().max(20).optional(),
      buttonUrl: z.string().trim().url().optional().or(z.literal("")),
      publicReplies: z.array(z.string().trim().max(300)).max(5).default([]),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { post } = await assertPostAccess(context.user.id, input.postId, "create");
    // Mexer na automação também exige o App Comments liberado (spec 0059, RF-7).
    if (!(await hasAppPermission(post.organizationId, context.user.id, "comments", "canEdit"))) {
      throw new ORPCError("FORBIDDEN", { message: "Seu papel não permite editar automações do Comments neste cliente." });
    }
    const { postId, ...config } = input;
    return savePlannerCommentsAutomation(postId, context.user.id, { ...config, buttonUrl: config.buttonUrl || undefined });
  });

export const listBroadcastTemplates = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationId: z.string(), trackingId: z.string() }))
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "schedule");
    return { templates: await listApprovedTemplates(input.organizationId, input.trackingId) };
  });

export const createScheduledBroadcastForClient = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      organizationId: z.string(),
      trackingId: z.string(),
      name: z.string().trim().min(1).max(120),
      templateName: z.string().min(1),
      templateLanguage: z.string().min(1),
      templateCategory: z.enum(["MARKETING", "UTILITY"]),
      templateVariableCount: z.number().int().min(0).max(20),
      bodyParams: z.array(broadcastTemplateParamSchema).max(20).default([]),
      audienceFilters: audienceFilterSchema.default({}),
      scheduledAt: z.coerce.date(),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPlannerOrganizationAccess(context.user.id, input.organizationId, "schedule");
    const broadcast = await createScheduledBroadcast({ ...input, userId: context.user.id });
    return { broadcast };
  });

export const listBroadcastsInRange = base
  .use(requiredAuthMiddleware)
  .input(z.object({ organizationIds: z.array(z.string()).max(50).optional(), from: z.coerce.date(), to: z.coerce.date() }))
  .handler(async ({ input, context }) => {
    if (input.to <= input.from || input.to.getTime() - input.from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      throw new ORPCError("BAD_REQUEST", { message: `Escolha um período de até ${MAX_RANGE_DAYS} dias.` });
    }
    const organizationIds = await resolvePlannerOrganizationIds(context.user.id, input.organizationIds);
    return { broadcasts: await listCalendarBroadcasts(organizationIds, input.from, input.to) };
  });
