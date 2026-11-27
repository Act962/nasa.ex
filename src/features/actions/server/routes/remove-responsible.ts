import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { removeActionResponsible } from "../lib/action-commands";

export const removeResponsible = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const responsible = await removeActionResponsible({ organizationId: context.org.id, actionId: input.actionId, userId: input.userId });
    return { responsible };
  });
