import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { moveWorkspaceAction } from "@/features/actions/server/lib/action-commands";

export const moveAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      columnId: z.string(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const action = await moveWorkspaceAction({
      organizationId: context.org.id,
      actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      },
      actionId: input.actionId,
      columnId: input.columnId,
      workspaceId: input.workspaceId,
    });
    return { action };
  });
