import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findSubActionGroupInOrg } from "../lib/action-access";

export const deleteSubActionGroup = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      groupId: z.string(),
      deleteSubActions: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await findSubActionGroupInOrg(
      input.groupId,
      context.org.id,
    );
    if (!existing) throw errors.NOT_FOUND({ message: "Grupo não encontrado" });

    if (input.deleteSubActions) {
      await prisma.subActions.deleteMany({
        where: { groupId: input.groupId },
      });
    }
    const group = await prisma.subActionGroup.delete({
      where: { id: input.groupId },
    });
    return { group };
  });
