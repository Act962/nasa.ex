import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import {
  deletePlannerComment,
  editPlannerOwnComment,
  listPlannerPostComments,
  replyToPlannerComment,
  setPlannerCommentHidden,
} from "@/features/nasa-planner/server/publishing/post-comments";

/** Comentários do post publicado no Instagram. Ler exige ver o post; agir em nome da marca exige poder programar. */

export const listPostComments = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), after: z.string().optional() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "view");
    return listPlannerPostComments(input.postId, input.after);
  });

export const replyToPostComment = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      postId: z.string(),
      commentId: z.string().min(1),
      text: z.string().trim().min(1, "Escreva a resposta").max(1000),
      channel: z.enum(["PUBLIC", "DIRECT_MESSAGE"]),
    }),
  )
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    return replyToPlannerComment(input);
  });

export const setPostCommentHidden = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), commentId: z.string().min(1), isHidden: z.boolean() }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    return setPlannerCommentHidden(input);
  });

export const deletePostComment = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), commentId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    return deletePlannerComment(input);
  });

export const editOwnPostComment = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string(), commentId: z.string().min(1), text: z.string().trim().min(1, "Escreva a resposta").max(1000) }))
  .handler(async ({ input, context }) => {
    await assertPostAccess(context.user.id, input.postId, "schedule");
    return editPlannerOwnComment(input);
  });
