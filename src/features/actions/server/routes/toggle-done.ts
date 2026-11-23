import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { setWorkspaceActionDone } from "../lib/action-commands";

export const toggleDone = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      isDone: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const action = await setWorkspaceActionDone({
      organizationId: context.org.id,
      actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      },
      actionId: input.actionId,
      isDone: input.isDone,
    });
    return { action };
  });
