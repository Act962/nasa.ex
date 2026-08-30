import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findActionInOrg } from "@/features/actions/server/lib/action-access";

export const removeTagFromAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string(), tagId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const action = await findActionInOrg(input.actionId, context.org.id);
    if (!action) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    await prisma.actionTag.delete({
      where: { actionId_tagId: { actionId: input.actionId, tagId: input.tagId } },
    });
    return { success: true };
  });
