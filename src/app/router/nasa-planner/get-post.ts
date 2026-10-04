import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { z } from "zod";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";

/** Post completo de qualquer cliente em que o usuário tem acesso ao Planner (spec 0058, RF-11). */
export const getPost = base
  .use(requiredAuthMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const { post, permissions } = await assertPostAccess(context.user.id, input.postId, "view");
    const { planner: _planner, ...postWithSlides } = post;
    return {
      post: postWithSlides,
      permissions: {
        canEdit: permissions.canCreate,
        canApprove: permissions.canApprove,
        canSchedule: permissions.canEdit || permissions.canApprove,
      },
    };
  });
