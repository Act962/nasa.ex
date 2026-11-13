import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { addActionTag } from "@/features/actions/server/lib/action-commands";

export const addTagToAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string(), tagId: z.string() }))
  .handler(async ({ input, context }) => {
    await addActionTag({ organizationId: context.org.id, actionId: input.actionId, tagId: input.tagId });
    return { success: true };
  });
