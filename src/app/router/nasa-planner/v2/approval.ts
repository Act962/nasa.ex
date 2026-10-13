import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { commentOnPost } from "@/features/nasa-planner/server/approval";
import { approveWithGroup, requestChangesWithGroup, schedulePublishGroup, submitForApprovalWithGroup } from "@/features/nasa-planner/server/publish-group";
import { schedulePlannerPost } from "@/features/nasa-planner/server/scheduling";
import { buildBrandChecklist } from "@/features/nasa-planner/lib/brand-checklist";
import { getBrandChecklistRulesForPost } from "@/features/nasa-planner/server/brand-kit/brand-kits";

/**
 * Aprovação do Planner (spec 0058, RF-3). Aprovar exige sessão de uma pessoa com `canApprove` na org do post.
 * Num grupo de contas a ação vale para todas (spec 0074, RF-7); `scope: "post"` restringe a uma conta.
 */

const scopeInput = z.enum(["post", "group"]).default("group");

export const submitForApproval = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), reviewerId: z.string().optional(), note: z.string().max(2000).optional(), scope: scopeInput }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "create");
    return submitForApprovalWithGroup({ ...input, actorId: context.user.id });
  });

export const requestChanges = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), body: z.string().trim().min(3).max(2000), slideId: z.string().optional(), scope: scopeInput }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "approve");
    await requestChangesWithGroup({ ...input, actorId: context.user.id });
    return { ok: true };
  });

export const approve = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      postId: z.string(),
      note: z.string().max(2000).optional(),
      checklist: z.record(z.string(), z.boolean()).optional(),
      scheduleAt: z.coerce.date().optional(),
      scope: scopeInput,
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "approve");
    const { scheduleAt, ...approval } = input;
    await approveWithGroup({ ...approval, actorId: context.user.id });
    if (scheduleAt) {
      if (input.scope === "group") await schedulePublishGroup({ postId: input.postId, scheduledAt: scheduleAt });
      else await schedulePlannerPost(input.postId, scheduleAt);
    }
    return { ok: true };
  });

export const comment = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), body: z.string().trim().min(1).max(2000), slideId: z.string().optional() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "view");
    const review = await commentOnPost({ ...input, actorId: context.user.id });
    return { review };
  });

export const listReviews = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const { post } = await assertPostAccess(context.user.id, input.postId, "view");
    const reviews = await prisma.nasaPlannerPostReview.findMany({ where: { postId: input.postId }, orderBy: { createdAt: "asc" } });
    const authorIds = [...new Set(reviews.map((review) => review.authorId).filter((authorId): authorId is string => Boolean(authorId)))];
    const authors = await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, image: true } });
    return {
      reviews: reviews.map((review) => ({ ...review, author: authors.find((author) => author.id === review.authorId) ?? null })),
      // Palavras proibidas vêm do kit da conta do post (spec 0070, RF-8).
      checklist: buildBrandChecklist(post, await getBrandChecklistRulesForPost(post)),
    };
  });
