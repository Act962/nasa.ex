import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { approvePost, commentOnPost, requestPostChanges, submitPostForApproval } from "@/features/nasa-planner/server/approval";
import { buildBrandChecklist } from "@/features/nasa-planner/lib/brand-checklist";

/** Aprovação do Planner (spec 0058, RF-3). Aprovar exige sessão de uma pessoa com `canApprove` na org do post. */

export const submitForApproval = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), reviewerId: z.string().optional(), note: z.string().max(2000).optional() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "create");
    return submitPostForApproval({ ...input, actorId: context.user.id });
  });

export const requestChanges = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), body: z.string().trim().min(3).max(2000), slideId: z.string().optional() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "approve");
    await requestPostChanges({ ...input, actorId: context.user.id });
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
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "approve");
    await approvePost({ ...input, actorId: context.user.id });
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
      checklist: buildBrandChecklist(post, post.planner),
    };
  });
