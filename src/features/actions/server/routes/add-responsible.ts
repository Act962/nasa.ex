import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { findActionInOrg, isOrgMember } from "../lib/action-access";

export const addResponsible = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const action = await findActionInOrg(input.actionId, context.org.id);
    if (!action) throw errors.NOT_FOUND({ message: "Ação não encontrada" });

    if (!(await isOrgMember(input.userId, context.org.id))) {
      throw errors.FORBIDDEN({
        message: "Usuário não pertence a esta organização",
      });
    }

    const responsible = await prisma.actionsUserResponsible.upsert({
      where: {
        actionId_userId: {
          actionId: input.actionId,
          userId: input.userId,
        },
      },
      create: {
        actionId: input.actionId,
        userId: input.userId,
      },
      update: {},
      include: {
        user: {
          select: { id: true, name: true, image: true, email: true },
        },
        action: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });

    return { responsible };
  });
