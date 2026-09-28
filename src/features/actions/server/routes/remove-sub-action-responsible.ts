import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findSubActionInOrg } from "../lib/action-access";

export const removeSubActionResponsible = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      subActionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const subAction = await findSubActionInOrg(
      input.subActionId,
      context.org.id,
    );
    if (!subAction) {
      throw errors.NOT_FOUND({ message: "Sub-ação não encontrada" });
    }

    const responsible = await prisma.subActionUserResponsible.delete({
      where: {
        userId_subActionId: {
          userId: input.userId,
          subActionId: input.subActionId,
        },
      },
      include: {
        subAction: {
          include: {
            action: {
              select: { id: true, workspaceId: true },
            },
          },
        },
      },
    });

    return { responsible };
  });
